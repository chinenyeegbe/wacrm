import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recovered-revenue queries. RLS scopes broadcast_recipients through
 * the owning broadcast, so no explicit user_id filtering is needed —
 * same convention as the rest of the dashboard queries.
 */

export interface RecoveredRevenueSummary {
  /** Sum of confirmed values this calendar month. */
  monthTotal: number
  /** Confirmed jobs (value > 0) this calendar month. */
  monthJobs: number
  /** Replied-but-unconfirmed campaign responses awaiting the owner. */
  pending: PendingRecovery[]
}

export interface PendingRecovery {
  recipientId: string
  contactName: string
  broadcastName: string
  repliedAt: string
}

export function startOfMonthIso(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export async function loadRecoveredRevenue(
  db: SupabaseClient,
  pendingLimit = 8,
): Promise<RecoveredRevenueSummary> {
  const monthStart = startOfMonthIso()

  const [confirmed, pendingRows] = await Promise.all([
    db
      .from('broadcast_recipients')
      .select('recovered_value')
      .not('recovered_value', 'is', null)
      .gte('recovered_at', monthStart),
    db
      .from('broadcast_recipients')
      .select(
        'id, replied_at, contact:contacts(name, phone), broadcast:broadcasts(name)',
      )
      .eq('status', 'replied')
      .is('recovered_value', null)
      .order('replied_at', { ascending: false })
      .limit(pendingLimit),
  ])

  let monthTotal = 0
  let monthJobs = 0
  for (const row of confirmed.data ?? []) {
    const v = Number(row.recovered_value) || 0
    monthTotal += v
    if (v > 0) monthJobs += 1
  }

  const pending: PendingRecovery[] = (pendingRows.data ?? []).map((r) => {
    // Many-to-one joins come back as objects; normalize defensively.
    const contactRaw = r.contact as unknown
    const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as
      | { name: string | null; phone: string | null }
      | null
    const broadcastRaw = r.broadcast as unknown
    const broadcast = (
      Array.isArray(broadcastRaw) ? broadcastRaw[0] : broadcastRaw
    ) as { name: string | null } | null
    return {
      recipientId: r.id as string,
      contactName: contact?.name || contact?.phone || 'Unknown contact',
      broadcastName: broadcast?.name || 'Campaign',
      repliedAt: (r.replied_at as string) ?? '',
    }
  })

  return { monthTotal, monthJobs, pending }
}

/**
 * Confirm what a campaign reply was worth. `value` of 0 records
 * "no job came of it" — the row leaves the pending queue without
 * inflating the total.
 */
export async function confirmRecoveredValue(
  db: SupabaseClient,
  recipientId: string,
  value: number,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('broadcast_recipients')
    .update({
      recovered_value: Math.max(0, value),
      recovered_at: new Date().toISOString(),
    })
    .eq('id', recipientId)
  return { error: error?.message ?? null }
}
