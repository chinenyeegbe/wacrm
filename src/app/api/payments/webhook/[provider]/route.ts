import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { computePlatformFee } from '@/lib/payments/providers'
import { splitCommission } from '@/lib/referrals/commission'
import type { PaymentProvider } from '@/types'

// Lazy admin client, mirrors the WhatsApp webhook so we don't crash at
// build time when env vars are absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/**
 * PSP payment webhook. Flips a payment_request pending → paid and, on the
 * paid transition, mirrors a confirmation into the conversation so the
 * merchant sees it land in their inbox.
 *
 * Security: we verify the provider's HMAC signature over the RAW body
 * using the merchant's own secret key. Because the signature is keyed on a
 * per-merchant secret, we first locate the payment_request by its
 * reference, load that merchant's key, then verify, a forged event for an
 * unknown reference is rejected before any key lookup.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== 'paystack' && provider !== 'flutterwave') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  // Read the raw body once, signature verification needs the exact bytes.
  const raw = await request.text()
  let event: Record<string, unknown>
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reference = extractReference(provider as PaymentProvider, event)
  if (!reference) {
    // Nothing actionable (e.g. a non-charge event), ack so the PSP stops retrying.
    return NextResponse.json({ ok: true, ignored: true })
  }

  const db = supabaseAdmin()
  const { data: pr, error: prErr } = await db
    .from('payment_requests')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()

  if (prErr || !pr) {
    // Unknown reference, reject forged/unrelated events.
    return NextResponse.json({ error: 'Unknown reference' }, { status: 404 })
  }

  // Load the merchant's payment secret to verify the signature.
  const { data: cfg } = await db
    .from('payment_config')
    .select('secret_key')
    .eq('user_id', pr.user_id)
    .maybeSingle()

  const secret = cfg?.secret_key ? decrypt(cfg.secret_key) : null
  if (!secret) {
    return NextResponse.json({ error: 'No verification key' }, { status: 400 })
  }

  if (!verifySignature(provider as PaymentProvider, request, raw, secret)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  // Idempotency: only act on the pending → paid transition once.
  if (pr.status === 'paid') {
    return NextResponse.json({ ok: true, already: true })
  }

  const paid = isPaidEvent(provider as PaymentProvider, event)
  if (!paid) {
    // A failed/cancelled signal, record it without confirming money.
    return NextResponse.json({ ok: true })
  }

  // Recompute the fee from the stored gross + the config at request time
  // (already persisted on the row) so the ledger is consistent.
  const feeMinor =
    pr.platform_fee_minor ?? computePlatformFee(pr.amount_minor, 0)

  await db
    .from('payment_requests')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      platform_fee_minor: feeMinor,
    })
    .eq('id', pr.id)
    .eq('status', 'pending') // guard: don't double-apply under a race

  // Mirror a confirmation into the conversation so it shows in the inbox.
  if (pr.conversation_id) {
    const amountMajor = (pr.amount_minor / 100).toFixed(2)
    await db.from('messages').insert({
      conversation_id: pr.conversation_id,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `✅ Payment received: ${pr.currency} ${amountMajor}${
        pr.description ? ` for ${pr.description}` : ''
      }. Thank you!`,
      status: 'sent',
    })
    await db
      .from('conversations')
      .update({
        last_message_text: 'Payment received',
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pr.conversation_id)
  }

  // Accrue a partner's referral earning, if this business was referred.
  // Best-effort and isolated: a failure here must never fail the webhook
  // (the payment is already confirmed). The merchant's bill is unchanged, 
  // the partner's share comes out of the platform fee.
  await accrueReferralEarning(db, pr, feeMinor).catch((err) => {
    console.error('[payments/webhook] referral accrual failed:', err)
  })

  return NextResponse.json({ ok: true })
}

/**
 * If the paying business's workspace was referred by a partner, write an
 * immutable referral_earnings row for the partner's share of the platform
 * fee, and bump the partner's denormalised lifetime stats.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function accrueReferralEarning(db: any, pr: any, feeMinor: number) {
  if (feeMinor <= 0) return

  // The merchant's workspace = the business that was referred. Use the
  // owner's personal workspace (agency mode: a business is a workspace).
  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('owner_id', pr.user_id)
    .eq('kind', 'personal')
    .maybeSingle()
  if (!ws) return

  const { data: referral } = await db
    .from('referrals')
    .select('id, partner_id, status')
    .eq('workspace_id', ws.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!referral) return

  const { data: partner } = await db
    .from('partners')
    .select('id, share_bps, status, total_earned_minor')
    .eq('id', referral.partner_id)
    .maybeSingle()
  if (!partner || partner.status !== 'active') return

  const split = splitCommission({
    grossMinor: pr.amount_minor,
    platformFeeMinor: feeMinor,
    partnerShareBps: partner.share_bps ?? 0,
  })
  if (split.partnerMinor <= 0) return

  await db.from('referral_earnings').insert({
    partner_id: partner.id,
    referral_id: referral.id,
    payment_request_id: pr.id,
    gross_minor: split.grossMinor,
    platform_fee_minor: split.platformFeeMinor,
    amount_minor: split.partnerMinor,
    share_bps: partner.share_bps ?? 0,
    currency: pr.currency,
    status: 'accrued',
  })

  await db
    .from('partners')
    .update({
      total_earned_minor:
        (partner.total_earned_minor ?? 0) + split.partnerMinor,
    })
    .eq('id', partner.id)
}

function extractReference(
  provider: PaymentProvider,
  event: Record<string, unknown>,
): string | null {
  const data = (event.data ?? {}) as Record<string, unknown>
  if (provider === 'paystack') {
    return (data.reference as string) || null
  }
  // flutterwave
  return (data.tx_ref as string) || (event['tx_ref'] as string) || null
}

function isPaidEvent(
  provider: PaymentProvider,
  event: Record<string, unknown>,
): boolean {
  const data = (event.data ?? {}) as Record<string, unknown>
  if (provider === 'paystack') {
    return event.event === 'charge.success' && data.status === 'success'
  }
  // flutterwave
  const status = (data.status as string) || ''
  return status.toLowerCase() === 'successful'
}

function verifySignature(
  provider: PaymentProvider,
  request: Request,
  raw: string,
  secret: string,
): boolean {
  if (provider === 'paystack') {
    const sig = request.headers.get('x-paystack-signature') || ''
    const expected = createHmac('sha512', secret).update(raw).digest('hex')
    return safeEqual(sig, expected)
  }
  // Flutterwave: the dashboard "secret hash" is sent verbatim in verif-hash.
  // Merchants set it to their secret key in our setup flow.
  const hash = request.headers.get('verif-hash') || ''
  return safeEqual(hash, secret)
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
