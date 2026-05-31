# Payments, the commission rail

wacrm can send a **payment link right inside the WhatsApp chat**, so the AI
doesn't just close the sale, it collects the money. This is also how a
hosted deployment earns: money moves through a link the platform mints, so
a commission is taken at settlement instead of being invoiced.

## Providers

| Provider | What you need | Notes |
| --- | --- | --- |
| **Paystack** | Secret key (`sk_live_…`) | Amounts in kobo/cents (minor units). |
| **Flutterwave** | Secret key | Set the dashboard "secret hash" to your secret key so webhooks verify. |
| **Manual** | Bank / mobile-money instructions | Zero setup, sent to the customer verbatim. Start here. |

## Setup

1. **Settings → Payments**, pick a provider.
2. For a gateway, paste your secret key, it's encrypted (AES-256-GCM)
   before storage, same as your WhatsApp token, and never shown again.
   For manual, paste your bank / M-Pesa instructions.
3. Set your default currency (NGN, KES, GHS, ZAR, …).
4. Point the provider's webhook at:
   - Paystack: `https://your-domain/api/payments/webhook/paystack`
   - Flutterwave: `https://your-domain/api/payments/webhook/flutterwave`

## Using it

Add a **Request Payment** step to any automation (or use the **AI Close &
Collect** template). When it runs it:

1. mints a checkout link via your provider,
2. records a `payment_request` with attribution (which conversation /
   automation closed it) and the platform fee taken,
3. sends the link to the customer on WhatsApp.

The amount can be a literal (`15000`) or read a value an upstream AI step
set (`{{vars.amount}}`), so the AI can negotiate a price and then collect
it.

When the customer pays, the provider's webhook flips the request to
**paid**, records the fee, and drops a "✅ Payment received" line into the
inbox conversation.

## The platform fee

`payment_config.platform_fee_bps` (basis points; 100 = 1%) is the
commission a hosted deployment takes on **collected** payments. It defaults
to **0**, self-hosters keep 100%. It is intentionally not editable from
the merchant settings UI; the platform operator sets it. Merchants only
ever pay it on money they actually receive.

## Security

- Secret keys encrypted at rest; never returned to the browser.
- Webhooks verify the provider's HMAC signature over the raw body using the
  merchant's own key; unknown references and bad signatures are rejected.
- Payment rows are writable only server-side (the create route and the
  webhook), a user can read their own history but cannot mark a request
  paid.
- Amounts are integer minor units end-to-end (no float drift).

See [`STRATEGY.md`](../STRATEGY.md) §5 for the full monetization model.
