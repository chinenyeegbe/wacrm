import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { verifyCronSecret } from '@/lib/cron-auth';
import { captureError } from '@/lib/observability';
import { resolveSmartAudienceIds } from '@/lib/broadcasts/audience';
import {
  processDuePlaybooks,
  type DuePlaybook,
  type PlaybookStore,
} from '@/lib/playbooks/runner';

/**
 * Run automated playbooks. Hit on a schedule (see CLOUDFLARE_DEPLOY.md
 * §4) with the shared `x-cron-secret`. Each due playbook resolves its
 * smart audience, drops contacts within its cooldown, and enqueues a
 * broadcast — the broadcast cron then does the actual sending.
 */

const RECIPIENT_INSERT_CHUNK = 500;

function makeStore(admin: SupabaseClient): PlaybookStore {
  return {
    async claimDuePlaybooks(beforeIso, limit) {
      // Enabled + (never run OR not run since start of today). Two reads
      // avoid a PostgREST or() with a timestamp value.
      const [neverRun, ranEarlier] = await Promise.all([
        admin
          .from('playbooks')
          .select('*')
          .eq('enabled', true)
          .is('last_run_at', null)
          .limit(limit),
        admin
          .from('playbooks')
          .select('*')
          .eq('enabled', true)
          .lt('last_run_at', beforeIso)
          .limit(limit),
      ]);
      const rows = [...(neverRun.data ?? []), ...(ranEarlier.data ?? [])].slice(
        0,
        limit,
      );
      return rows.map(
        (r): DuePlaybook => ({
          id: r.id as string,
          user_id: r.user_id as string,
          name: r.name as string,
          audience_type: r.audience_type as DuePlaybook['audience_type'],
          window_days: (r.window_days as number) ?? 30,
          cooldown_days: (r.cooldown_days as number) ?? 30,
          template_name: r.template_name as string,
          template_language: (r.template_language as string) ?? 'en_US',
          template_variables:
            (r.template_variables as DuePlaybook['template_variables']) ?? null,
        }),
      );
    },

    async resolveAudienceContactIds(playbook) {
      // Service-role client bypasses RLS, so scope explicitly by user.
      return resolveSmartAudienceIds(
        admin,
        playbook.audience_type,
        playbook.window_days,
        playbook.user_id,
      );
    },

    async recentlyMessagedContactIds(playbookId, sinceIso) {
      // Contacts who were recipients of a broadcast from this playbook
      // since the cooldown cutoff.
      const { data: broadcasts } = await admin
        .from('broadcasts')
        .select('id')
        .eq('playbook_id', playbookId);
      const broadcastIds = (broadcasts ?? []).map((b) => b.id as string);
      if (broadcastIds.length === 0) return new Set();

      const { data } = await admin
        .from('broadcast_recipients')
        .select('contact_id')
        .in('broadcast_id', broadcastIds)
        .gte('created_at', sinceIso);
      return new Set((data ?? []).map((r) => r.contact_id as string));
    },

    async enqueueBroadcast(playbook, contactIds) {
      const { data: broadcast, error } = await admin
        .from('broadcasts')
        .insert({
          user_id: playbook.user_id,
          playbook_id: playbook.id,
          name: `${playbook.name} — ${new Date().toLocaleDateString()}`,
          template_name: playbook.template_name,
          template_language: playbook.template_language,
          template_variables: playbook.template_variables,
          status: 'queued',
          total_recipients: contactIds.length,
        })
        .select('id')
        .single();
      if (error || !broadcast) {
        captureError('playbooks_cron.enqueue_failed', error, {
          playbook_id: playbook.id,
        });
        return null;
      }

      const rows = contactIds.map((contact_id) => ({
        broadcast_id: broadcast.id as string,
        contact_id,
        status: 'pending' as const,
      }));
      for (let i = 0; i < rows.length; i += RECIPIENT_INSERT_CHUNK) {
        const { error: recErr } = await admin
          .from('broadcast_recipients')
          .insert(rows.slice(i, i + RECIPIENT_INSERT_CHUNK));
        if (recErr) {
          captureError('playbooks_cron.recipients_failed', recErr, {
            playbook_id: playbook.id,
            broadcast_id: broadcast.id,
          });
          // Mark the half-built broadcast failed so the runner won't send
          // a partial audience.
          await admin
            .from('broadcasts')
            .update({ status: 'failed' })
            .eq('id', broadcast.id);
          return null;
        }
      }
      return broadcast.id as string;
    },

    async markRan(playbookId, ranAtIso) {
      await admin
        .from('playbooks')
        .update({ last_run_at: ranAtIso, updated_at: ranAtIso })
        .eq('id', playbookId);
    },
  };
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = supabaseAdmin();
  try {
    const summary = await processDuePlaybooks(makeStore(admin));
    return NextResponse.json(summary);
  } catch (error) {
    captureError('playbooks_cron.failed', error);
    return NextResponse.json(
      { error: 'playbook runner failed' },
      { status: 500 },
    );
  }
}
