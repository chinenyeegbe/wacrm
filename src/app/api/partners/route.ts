import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  generatePartnerCode,
  normalizeCode,
  buildReferralUrl,
} from '@/lib/referrals/codes'

/**
 * Partner self-service.
 *   GET  — fetch the caller's partner profile + shareable link (or null).
 *   POST — become a partner (idempotent): mints a unique code if the
 *          caller doesn't already have one.
 *
 * Becoming a partner is open to any authenticated user — that openness is
 * the point: anyone can start selling wacrm in their neighbourhood. Earnings
 * are gated downstream (only paid on real, settled referred payments).
 */

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: partner, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!partner) return NextResponse.json({ partner: null })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm.tech'
  return NextResponse.json({
    partner,
    referral_url: buildReferralUrl(siteUrl, partner.code),
  })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()

  // Idempotent: return the existing partner if there is one.
  const { data: existing } = await admin
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm.tech'
  if (existing) {
    return NextResponse.json({
      partner: existing,
      referral_url: buildReferralUrl(siteUrl, existing.code),
    })
  }

  // Seed the code from the display name for a friendly prefix.
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()

  // Mint a unique code, retrying on the (rare) collision.
  let code = ''
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = normalizeCode(generatePartnerCode(profile?.full_name))
    const { data: clash } = await admin
      .from('partners')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()
    if (!clash) {
      code = candidate
      break
    }
  }
  if (!code) {
    return NextResponse.json(
      { error: 'Could not allocate a unique code, please retry' },
      { status: 503 },
    )
  }

  const { data: partner, error: insErr } = await admin
    .from('partners')
    .insert({ user_id: user.id, code })
    .select()
    .single()

  if (insErr || !partner) {
    return NextResponse.json(
      { error: insErr?.message ?? 'Failed to create partner' },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { partner, referral_url: buildReferralUrl(siteUrl, partner.code) },
    { status: 201 },
  )
}
