import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Broadcast audience definitions, shared by the wizard (audience picker
 * + estimate) and the send hook so the estimate and the actual send can
 * never diverge.
 *
 * "Smart" audiences are the playbook wedge from the strategic audit:
 * instead of blasting everyone, target the customers most likely to
 * generate repeat revenue — those with a service coming due, those
 * recently served (for a review ask), and dormant past customers to
 * win back. They key off the job-record fields (migration 018) and
 * conversation recency.
 */

export type CustomFieldOperator = 'is' | 'is_not' | 'contains';

export interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export type SmartAudienceType =
  | 'service_due'
  | 'recently_completed'
  | 'dormant';

export type AudienceType =
  | 'all'
  | 'tags'
  | 'custom_field'
  | 'csv'
  | SmartAudienceType;

export interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  /** Contacts carrying any of these tags are subtracted from the result. */
  excludeTagIds?: string[];
  /** Rolling window in days for a smart audience (falls back to the
   *  type's default when unset). */
  smartWindowDays?: number;
}

export interface SmartAudienceDef {
  type: SmartAudienceType;
  label: string;
  description: string;
  /** Default window used when the user hasn't overridden it. */
  defaultWindowDays: number;
  /** Label for the window control. */
  windowLabel: string;
}

export const SMART_AUDIENCES: SmartAudienceDef[] = [
  {
    type: 'service_due',
    label: 'Service due soon',
    description: 'Customers whose next service falls within the window.',
    defaultWindowDays: 14,
    windowLabel: 'Due within (days)',
  },
  {
    type: 'recently_completed',
    label: 'Recently served',
    description: 'Customers served in the window — ideal for a review ask.',
    defaultWindowDays: 7,
    windowLabel: 'Served in the last (days)',
  },
  {
    type: 'dormant',
    label: 'Dormant customers',
    description: 'Past customers who have gone quiet — win them back.',
    defaultWindowDays: 180,
    windowLabel: 'No contact for at least (days)',
  },
];

const SMART_TYPES = new Set<SmartAudienceType>(
  SMART_AUDIENCES.map((a) => a.type),
);

export function isSmartAudience(type: AudienceType): type is SmartAudienceType {
  return SMART_TYPES.has(type as SmartAudienceType);
}

/** Resolve the effective window for a smart audience, applying the
 *  per-type default when the config doesn't set one. */
export function smartWindowDays(config: AudienceConfig): number {
  if (config.smartWindowDays && config.smartWindowDays > 0) {
    return config.smartWindowDays;
  }
  const def = SMART_AUDIENCES.find((a) => a.type === config.type);
  return def?.defaultWindowDays ?? 30;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolve a smart audience to the matching contact IDs.
 *
 * With an RLS-scoped client (the browser client), pass no `userId` — RLS
 * limits results to the current user. With a service-role client (the
 * playbook/broadcast cron), pass `userId` to scope explicitly, since the
 * service role bypasses RLS. Shared by the estimate, the send path, and
 * the playbook engine so they always agree on who matches.
 */
export async function resolveSmartAudienceIds(
  supabase: SupabaseClient,
  type: SmartAudienceType,
  windowDays: number,
  userId?: string,
): Promise<string[]> {
  const now = new Date();

  if (type === 'service_due') {
    // Service due between today and today+window (upcoming, not overdue-
    // forever). Uses idx_contacts_next_due_date.
    const until = new Date(now.getTime() + windowDays * 86_400_000);
    let q = supabase
      .from('contacts')
      .select('id')
      .not('next_due_date', 'is', null)
      .gte('next_due_date', ymd(now))
      .lte('next_due_date', ymd(until));
    if (userId) q = q.eq('user_id', userId);
    const { data } = await q;
    return (data ?? []).map((r) => r.id as string);
  }

  if (type === 'recently_completed') {
    const since = new Date(now.getTime() - windowDays * 86_400_000);
    let q = supabase
      .from('contacts')
      .select('id')
      .not('last_service_date', 'is', null)
      .gte('last_service_date', ymd(since));
    if (userId) q = q.eq('user_id', userId);
    const { data } = await q;
    return (data ?? []).map((r) => r.id as string);
  }

  // dormant — a contact whose most recent conversation activity is older
  // than the window. Deduped across conversations.
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000);
  let q = supabase
    .from('conversations')
    .select('contact_id')
    .not('last_message_at', 'is', null)
    .lt('last_message_at', cutoff.toISOString());
  if (userId) q = q.eq('user_id', userId);
  const { data } = await q;
  return [...new Set((data ?? []).map((r) => r.contact_id as string))];
}
