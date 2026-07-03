import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { resolveVariables, type VariableMapping } from '@/lib/broadcasts/variables';
import type { Contact } from '@/types';

/**
 * Server-side broadcast runner.
 *
 * Pure orchestration: all database IO goes through `BroadcastStore` and
 * every Meta send through `BroadcastSender`, so the queue logic here is
 * unit-testable with fakes and has no Supabase / network dependency.
 *
 * The cron route (`/api/broadcasts/cron`) supplies the real, service-
 * role-backed store and a Meta-backed sender. Draining is resumable:
 * each tick processes a bounded number of sends, leaving the rest
 * `pending`, and finalizes a broadcast only once no pending recipients
 * remain.
 */

export interface DueBroadcast {
  id: string;
  user_id: string;
  template_name: string;
  template_language: string;
  template_variables: Record<string, VariableMapping> | null;
}

export interface PendingRecipient {
  id: string;
  contact: Contact | null;
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/** A per-recipient send function, or `null` when the broadcast can't be
 *  sent at all (e.g. WhatsApp not configured for that user). */
export type PreparedSender =
  | ((recipient: PendingRecipient, params: string[]) => Promise<SendResult>)
  | null;

export interface BroadcastSender {
  prepare(broadcast: DueBroadcast): Promise<PreparedSender>;
}

/** contactId → (customFieldId → value). */
export type CustomValueIndex = Map<string, Map<string, string>>;

export interface BroadcastStore {
  /** Claim broadcasts that are ready to send (queued / in-progress, or a
   *  scheduled one whose time has come), flipping them to 'sending'. */
  claimDueBroadcasts(nowIso: string, limit: number): Promise<DueBroadcast[]>;
  /** Normalized phones of the user's opted-out contacts (suppression). */
  loadOptedOutPhones(userId: string): Promise<Set<string>>;
  fetchPendingRecipients(
    broadcastId: string,
    limit: number,
  ): Promise<PendingRecipient[]>;
  fetchCustomValues(contactIds: string[]): Promise<CustomValueIndex>;
  markSkipped(recipientId: string): Promise<void>;
  markSent(recipientId: string, messageId: string): Promise<void>;
  markFailed(recipientId: string, error: string): Promise<void>;
  countPending(broadcastId: string): Promise<number>;
  /** Set the broadcast's terminal status ('sent' if any recipient was
   *  sent, else 'failed'). Only called when no pending remain. */
  finalizeBroadcast(broadcastId: string): Promise<void>;
}

export interface RunnerOptions {
  now?: Date;
  /** Max broadcasts to touch per tick. */
  maxBroadcastsPerTick?: number;
  /** Max Meta sends per tick (bounds CPU / time on a serverless run). */
  maxSendsPerTick?: number;
}

export interface RunnerSummary {
  broadcasts: number;
  sent: number;
  failed: number;
  skipped: number;
}

const DEFAULT_MAX_BROADCASTS = 5;
const DEFAULT_MAX_SENDS = 200;

export async function processDueBroadcasts(
  store: BroadcastStore,
  sender: BroadcastSender,
  options: RunnerOptions = {},
): Promise<RunnerSummary> {
  const now = options.now ?? new Date();
  const maxBroadcasts = options.maxBroadcastsPerTick ?? DEFAULT_MAX_BROADCASTS;
  let budget = options.maxSendsPerTick ?? DEFAULT_MAX_SENDS;

  const summary: RunnerSummary = {
    broadcasts: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const due = await store.claimDueBroadcasts(now.toISOString(), maxBroadcasts);

  for (const broadcast of due) {
    summary.broadcasts += 1;

    const send = await sender.prepare(broadcast);
    const optedOut = await store.loadOptedOutPhones(broadcast.user_id);

    if (budget > 0) {
      const recipients = await store.fetchPendingRecipients(broadcast.id, budget);
      const contactIds = recipients
        .map((r) => r.contact?.id)
        .filter((id): id is string => Boolean(id));
      const customValues = await store.fetchCustomValues(contactIds);

      for (const recipient of recipients) {
        const contact = recipient.contact;

        if (!contact?.phone) {
          await store.markFailed(recipient.id, 'No phone number on contact');
          summary.failed += 1;
          continue;
        }

        // Suppress opted-out contacts (does not consume send budget).
        if (optedOut.has(normalizePhone(contact.phone))) {
          await store.markSkipped(recipient.id);
          summary.skipped += 1;
          continue;
        }

        if (!send) {
          await store.markFailed(recipient.id, 'WhatsApp not configured');
          summary.failed += 1;
          continue;
        }

        const params = resolveVariables(
          broadcast.template_variables ?? {},
          contact,
          customValues.get(contact.id),
        );
        const result = await send(recipient, params);
        if (result.ok) {
          await store.markSent(recipient.id, result.messageId);
          summary.sent += 1;
        } else {
          await store.markFailed(recipient.id, result.error);
          summary.failed += 1;
        }
        budget -= 1;
        if (budget <= 0) break;
      }
    }

    // Finalize only when the whole broadcast is drained; otherwise it
    // stays 'sending' and the next tick continues where we left off.
    const pending = await store.countPending(broadcast.id);
    if (pending === 0) {
      await store.finalizeBroadcast(broadcast.id);
    }
  }

  return summary;
}
