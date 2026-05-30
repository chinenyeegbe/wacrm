import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { encrypt } from '@/lib/whatsapp/encryption'
import type { PaymentProvider } from '@/types'

/**
 * Read / write the merchant's payment configuration.
 *
 * The provider secret is encrypted server-side (AES-256-GCM, same as the
 * WhatsApp token) before it touches the database, so it is written via the
 * service-role client here rather than from the browser. GET never returns
 * the secret — only whether one is set.
 */

const VALID_PROVIDERS: PaymentProvider[] = ['paystack', 'flutterwave', 'manual']

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('payment_config')
    .select(
      'provider, manual_instructions, default_currency, platform_fee_bps, status, secret_key',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Strip the secret; expose only whether one exists.
  const config = data
    ? {
        provider: data.provider,
        manual_instructions: data.manual_instructions,
        default_currency: data.default_currency,
        platform_fee_bps: data.platform_fee_bps,
        status: data.status,
        has_secret: !!data.secret_key,
      }
    : null

  return NextResponse.json({ config })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const provider = body.provider as PaymentProvider
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const defaultCurrency = String(body.default_currency || 'NGN')
    .toUpperCase()
    .slice(0, 3)
  const manualInstructions =
    typeof body.manual_instructions === 'string'
      ? body.manual_instructions.slice(0, 2000)
      : null

  // Gateways need a key; manual does not.
  const secretInput =
    typeof body.secret_key === 'string' ? body.secret_key.trim() : ''

  const admin = supabaseAdmin()

  // Preserve an existing secret when the user saves without re-entering it
  // (the form never round-trips the secret back to the browser).
  const { data: existing } = await admin
    .from('payment_config')
    .select('secret_key')
    .eq('user_id', user.id)
    .maybeSingle()

  let encryptedSecret: string | null = existing?.secret_key ?? null
  if (secretInput) {
    encryptedSecret = encrypt(secretInput)
  } else if (provider === 'manual') {
    encryptedSecret = null
  }

  const connected =
    provider === 'manual' ? !!manualInstructions : !!encryptedSecret

  const { error } = await admin.from('payment_config').upsert(
    {
      user_id: user.id,
      provider,
      secret_key: encryptedSecret,
      manual_instructions: manualInstructions,
      default_currency: defaultCurrency,
      // platform_fee_bps is set by the platform operator, not merchants —
      // we don't accept it from this endpoint. Defaults to 0 (migration).
      status: connected ? 'connected' : 'disconnected',
    },
    { onConflict: 'user_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: connected ? 'connected' : 'disconnected' })
}
