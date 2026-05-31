import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * Partner payouts.
 *   GET, list the caller's payout history.
 *   POST, request a payout of the caller's accrued balance. The heavy
 *          lifting (sum + atomic claim of accrued earnings) is done by the
 *          request_partner_payout() SQL function so a balance can't be
 *          double-withdrawn under a race.
 */

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS scopes partner_payouts to rows the caller owns (via partners).
  const { data, error } = await supabase
    .from('partner_payouts')
    .select('*')
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payouts: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()

  // Resolve the caller's partner row (and let them update payout details in
  // the same request, so they can add a bank account just before cashing out).
  const { data: partner } = await admin
    .from('partners')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!partner) {
    return NextResponse.json({ error: 'Not a partner' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const payoutDetails =
    typeof body?.payout_details === 'string'
      ? body.payout_details.slice(0, 500)
      : undefined
  if (payoutDetails !== undefined) {
    await admin
      .from('partners')
      .update({ payout_details: payoutDetails })
      .eq('id', partner.id)
  }

  // Atomic claim of the accrued balance → a new pending payout.
  const { data: payoutId, error: rpcErr } = await admin.rpc(
    'request_partner_payout',
    { p_partner_id: partner.id },
  )

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }
  if (!payoutId) {
    return NextResponse.json(
      { error: 'No balance available to withdraw' },
      { status: 400 },
    )
  }

  const { data: payout } = await admin
    .from('partner_payouts')
    .select('*')
    .eq('id', payoutId)
    .single()

  return NextResponse.json({ payout }, { status: 201 })
}
