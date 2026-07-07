import type { VariableMapping } from '@/lib/broadcasts/variables';
import type { SmartAudienceType } from '@/lib/broadcasts/audience';

/**
 * Automated playbook runner.
 *
 * Pure orchestration behind a `PlaybookStore`, so the scheduling and
 * dedupe logic is unit-testable with fakes. Each tick:
 *   1. claim enabled playbooks due to run (at most once per day),
 *   2. resolve the smart audience,
 *   3. drop contacts messaged by this playbook within its cooldown,
 *   4. enqueue a broadcast (the existing broadcast runner then sends it),
 *   5. stamp last_run_at.
 *
 * The playbook never sends directly — it produces a queued broadcast, so
 * all the Meta sending, opt-out suppression, and finalization live in one
 * place (the broadcast runner).
 */

export interface DuePlaybook {
  id: string;
  user_id: string;
  name: string;
  audience_type: SmartAudienceType;
  window_days: number;
  cooldown_days: number;
  template_name: string;
  template_language: string;
  template_variables: Record<string, VariableMapping> | null;
}

export interface PlaybookStore {
  /** Enabled playbooks whose last_run_at is null or before `beforeIso`
   *  (used to enforce at-most-once-per-day). */
  claimDuePlaybooks(beforeIso: string, limit: number): Promise<DuePlaybook[]>;
  /** Contact IDs matching the playbook's smart audience (user-scoped). */
  resolveAudienceContactIds(playbook: DuePlaybook): Promise<string[]>;
  /** Contact IDs this playbook already messaged since `sinceIso` — its
   *  cooldown set, to be excluded. */
  recentlyMessagedContactIds(
    playbookId: string,
    sinceIso: string,
  ): Promise<Set<string>>;
  /** Create a queued broadcast + pending recipients for these contacts.
   *  Returns the broadcast id, or null if nothing was created. */
  enqueueBroadcast(
    playbook: DuePlaybook,
    contactIds: string[],
  ): Promise<string | null>;
  /** Stamp last_run_at so the playbook isn't re-run today. */
  markRan(playbookId: string, ranAtIso: string): Promise<void>;
}

export interface PlaybookRunnerOptions {
  now?: Date;
  maxPlaybooksPerTick?: number;
}

export interface PlaybookRunSummary {
  playbooks: number;
  enqueued: number;
  recipients: number;
  skippedNoAudience: number;
}

const DEFAULT_MAX_PLAYBOOKS = 20;
const DAY_MS = 86_400_000;

export async function processDuePlaybooks(
  store: PlaybookStore,
  options: PlaybookRunnerOptions = {},
): Promise<PlaybookRunSummary> {
  const now = options.now ?? new Date();
  const max = options.maxPlaybooksPerTick ?? DEFAULT_MAX_PLAYBOOKS;

  const summary: PlaybookRunSummary = {
    playbooks: 0,
    enqueued: 0,
    recipients: 0,
    skippedNoAudience: 0,
  };

  // "Due" = enabled and not run since the start of today (once/day).
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const due = await store.claimDuePlaybooks(startOfToday, max);

  for (const playbook of due) {
    summary.playbooks += 1;

    const audience = await store.resolveAudienceContactIds(playbook);
    // Always stamp last_run_at, even on an empty run, so a playbook that
    // currently matches nobody doesn't get retried every tick today.
    await store.markRan(playbook.id, now.toISOString());

    if (audience.length === 0) {
      summary.skippedNoAudience += 1;
      continue;
    }

    const cooldownSince = new Date(
      now.getTime() - playbook.cooldown_days * DAY_MS,
    ).toISOString();
    const suppressed = await store.recentlyMessagedContactIds(
      playbook.id,
      cooldownSince,
    );
    const targets = audience.filter((id) => !suppressed.has(id));

    if (targets.length === 0) {
      summary.skippedNoAudience += 1;
      continue;
    }

    const broadcastId = await store.enqueueBroadcast(playbook, targets);
    if (broadcastId) {
      summary.enqueued += 1;
      summary.recipients += targets.length;
    }
  }

  return summary;
}
