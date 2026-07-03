import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { verifyCronSecret } from '@/lib/cron-auth';
import { captureError } from '@/lib/observability';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils';
import {
  processDueBroadcasts,
  type BroadcastSender,
  type BroadcastStore,
  type CustomValueIndex,
  type DueBroadcast,
  type PendingRecipient,
} from '@/lib/broadcasts/runner';
import type { Contact } from '@/types';

/**
 * Drain queued / in-progress broadcasts. Meant to be hit on a schedule
 * (see CLOUDFLARE_DEPLOY.md §4) with the shared `x-cron-secret`. Moves
 * broadcast sending off the browser tab: the wizard now only enqueues
 * (persists recipients + marks the broadcast 'queued'); this endpoint
 * does the actual Meta sends, resumably and server-side.
 */

const BROADCAST_COLS =
  'id, user_id, template_name, template_language, template_variables';

function makeStore(admin: SupabaseClient): BroadcastStore {
  return {
    async claimDueBroadcasts(nowIso, limit) {
      // Two disjoint reads (by status) avoid escaping a timestamp inside
      // a PostgREST or() filter: ready-now vs a scheduled one whose time
      // has come.
      const [readyNow, scheduled] = await Promise.all([
        admin
          .from('broadcasts')
          .select(BROADCAST_COLS)
          .in('status', ['queued', 'sending'])
          .order('created_at', { ascending: true })
          .limit(limit),
        admin
          .from('broadcasts')
          .select(BROADCAST_COLS)
          .eq('status', 'scheduled')
          .lte('scheduled_at', nowIso)
          .order('created_at', { ascending: true })
          .limit(limit),
      ]);

      const rows = [...(readyNow.data ?? []), ...(scheduled.data ?? [])].slice(
        0,
        limit,
      );
      if (rows.length === 0) return [];

      // Claim: flip queued/scheduled to 'sending' (leaves already-
      // 'sending' rows untouched) so the broadcast reads as in-progress.
      const ids = rows.map((r) => r.id as string);
      await admin
        .from('broadcasts')
        .update({ status: 'sending' })
        .in('id', ids)
        .neq('status', 'sending');

      return rows.map(
        (r): DueBroadcast => ({
          id: r.id as string,
          user_id: r.user_id as string,
          template_name: r.template_name as string,
          template_language: (r.template_language as string) ?? 'en_US',
          template_variables:
            (r.template_variables as DueBroadcast['template_variables']) ??
            null,
        }),
      );
    },

    async loadOptedOutPhones(userId) {
      const { data } = await admin
        .from('contacts')
        .select('phone_normalized')
        .eq('user_id', userId)
        .not('marketing_opted_out_at', 'is', null);
      return new Set(
        (data ?? [])
          .map((c) => c.phone_normalized as string | null)
          .filter((p): p is string => !!p),
      );
    },

    async fetchPendingRecipients(broadcastId, limit) {
      const { data } = await admin
        .from('broadcast_recipients')
        .select('id, contact:contacts(*)')
        .eq('broadcast_id', broadcastId)
        .eq('status', 'pending')
        .limit(limit);
      return (data ?? []).map((r): PendingRecipient => {
        // A many-to-one join returns an object; normalize defensively.
        const c = r.contact as unknown;
        const contact = (Array.isArray(c) ? c[0] : c) as Contact | null;
        return { id: r.id as string, contact: contact ?? null };
      });
    },

    async fetchCustomValues(contactIds) {
      const index: CustomValueIndex = new Map();
      if (contactIds.length === 0) return index;
      const PAGE = 500;
      for (let i = 0; i < contactIds.length; i += PAGE) {
        const slice = contactIds.slice(i, i + PAGE);
        const { data } = await admin
          .from('contact_custom_values')
          .select('contact_id, custom_field_id, value')
          .in('contact_id', slice);
        for (const row of data ?? []) {
          const bucket =
            index.get(row.contact_id as string) ?? new Map<string, string>();
          bucket.set(
            row.custom_field_id as string,
            (row.value as string) ?? '',
          );
          index.set(row.contact_id as string, bucket);
        }
      }
      return index;
    },

    async markSkipped(recipientId) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'skipped',
          error_message: 'Contact opted out of marketing',
        })
        .eq('id', recipientId);
    },

    async markSent(recipientId, messageId) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          whatsapp_message_id: messageId,
          error_message: null,
        })
        .eq('id', recipientId);
    },

    async markFailed(recipientId, error) {
      await admin
        .from('broadcast_recipients')
        .update({ status: 'failed', error_message: error })
        .eq('id', recipientId);
    },

    async countPending(broadcastId) {
      const { count } = await admin
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', broadcastId)
        .eq('status', 'pending');
      return count ?? 0;
    },

    async finalizeBroadcast(broadcastId) {
      // Counts are trigger-maintained (migration 005); 'sent' if any
      // recipient made it out, otherwise 'failed'.
      const { data } = await admin
        .from('broadcasts')
        .select('sent_count')
        .eq('id', broadcastId)
        .maybeSingle();
      const status = ((data?.sent_count as number) ?? 0) > 0 ? 'sent' : 'failed';
      await admin.from('broadcasts').update({ status }).eq('id', broadcastId);
    },
  };
}

function makeSender(admin: SupabaseClient): BroadcastSender {
  return {
    async prepare(broadcast) {
      const { data: config } = await admin
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', broadcast.user_id)
        .maybeSingle();
      if (!config) return null;

      const accessToken = decrypt(config.access_token as string);
      const { data: templateRow } = await admin
        .from('message_templates')
        .select('*')
        .eq('user_id', broadcast.user_id)
        .eq('name', broadcast.template_name)
        .eq('language', broadcast.template_language)
        .maybeSingle();
      const template =
        templateRow && isMessageTemplate(templateRow) ? templateRow : undefined;

      return async (recipient, params) => {
        const phone = recipient.contact?.phone ?? '';
        const sanitized = sanitizePhoneForMeta(phone);
        if (!isValidE164(sanitized)) {
          return { ok: false, error: 'Invalid phone number format' };
        }
        // Retry across trunk-prefix variants on "not in allowed list",
        // mirroring the interactive broadcast route.
        let lastError = 'Unknown error';
        for (const variant of phoneVariants(sanitized)) {
          try {
            const result = await sendTemplateMessage({
              phoneNumberId: config.phone_number_id as string,
              accessToken,
              to: variant,
              templateName: broadcast.template_name,
              language: broadcast.template_language,
              template,
              params,
            });
            return { ok: true, messageId: result.messageId };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            if (!isRecipientNotAllowedError(message)) {
              return { ok: false, error: message };
            }
            lastError = message;
          }
        }
        return { ok: false, error: lastError };
      };
    },
  };
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = supabaseAdmin();
  try {
    const summary = await processDueBroadcasts(
      makeStore(admin),
      makeSender(admin),
    );
    return NextResponse.json(summary);
  } catch (error) {
    captureError('broadcasts_cron.failed', error);
    return NextResponse.json(
      { error: 'broadcast runner failed' },
      { status: 500 },
    );
  }
}
