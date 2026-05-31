# Growth & network effects

How wacrm grows itself, the partner network (built), and the bigger plan
for global relevance and compounding network effects. Pairs with
[`STRATEGY.md`](../STRATEGY.md).

---

## The core idea

A product that businesses pay for only when they make money is great, but
it still has to *reach* those businesses. In African markets, reach is won
by **people and trust**, not ad budgets. So our distribution engine is a
**partner network**: anyone can become a partner, sell wacrm to businesses
in their neighbourhood and network, and earn a **recurring share of every
sale those businesses collect**, forever.

The magic property: partners are paid out of **our** commission, not added
to the merchant's bill. So all three parties want the same thing, more
sales. That alignment is what makes it spread.

---

## What's built (this slice)

- **Partner identity**, any user taps "Become a partner" (`/partner`) and
  gets a short, shareable code (e.g. `ADA-7K3Q`) and an invite link.
- **Attribution**, a business signing up via `?ref=CODE` is tagged as that
  partner's referral (captured at signup, survives email confirmation).
- **Recurring earnings**, when a referred business collects a payment, the
  payments webhook automatically accrues the partner's share into an
  immutable ledger (`referral_earnings`). Their dashboard shows pending and
  lifetime earnings.
- **Tiered rewards**, the more businesses a partner brings, the bigger
  their share (20% → 50% of the platform fee). Top sellers are rewarded for
  recruiting whole markets.
- **Pure, tested money math**, `src/lib/referrals/` (codes + commission
  split) with 21 unit tests; integer minor units, no float drift, platform
  absorbs rounding.

Tables: `partners`, `referrals`, `referral_earnings` (migration 020).

---

## Idea 1, How we create *global* relevance

wacrm starts hyper-local (a market in Lagos, Nairobi, Accra) but the same
machine generalises. The path to global relevance:

1. **WhatsApp is already global.** The product needs no rebuild to work in
   Karachi, Manila, São Paulo, or Cairo, only WhatsApp + a payment
   provider. The AI already mirrors the customer's language.
2. **Localise the rails, not the product.** "Global" = plugging in the
   local payment provider and the local languages/idioms per region. The
   provider layer (`lib/payments/providers.ts`) and the free-LLM layer are
   built to add providers/models without touching features.
3. **Templates carry culture.** A "skill"/template marketplace lets local
   experts encode what *their* market needs (negotiation styles, local
   compliance, sector nuance). Relevance becomes crowd-sourced per region.
4. **Open-source as a global funnel.** The MIT template is discoverable
   worldwide; self-hosters in any country become candidates for the hosted,
   commission-based service, and for the partner network.
5. **One proof travels.** "An AI that sells on WhatsApp and only charges
   when you get paid" is a universally legible promise. Win one market
   loudly, and the story (and the partners) carry it to the next.

The honest sequencing: **dominate one corridor first** (deep, not wide),
because density is what makes the partner network and word-of-mouth ignite.
Global relevance is the *output* of repeating a won market, not a starting
move.

---

## Idea 2, Individuals selling it in their neighbourhoods

This is the partner network, and it's the single best fit for the market.
Why it works and what makes it work:

- **Zero-risk to the buyer.** A partner can say "it costs you nothing to
  start; you only pay a small cut when it makes you a sale." That removes
  the #1 objection (subscriptions) at the door.
- **The seller is paid like an owner, not a clerk.** Recurring share of
  GMV, not a one-off bounty, so partners keep their businesses *succeeding*
  (helping them set up the AI, write the catalogue), which raises retention
  for everyone. Their incentive = our incentive = the merchant's.
- **Trust travels through networks.** A shop owner believes their cousin or
  the person who runs the next stall, not a cold ad. Partners are the trust
  bridge.
- **Tiered status.** The ladder (20→50%) turns a casual referrer into a
  "super-connector" who signs up a whole market and recruits sub-sellers.

### What makes that network actually work (the supporting pieces)

| Need | Why | Status |
| --- | --- | --- |
| Become-a-partner + link | The on-ramp | ✅ built |
| Attribution at signup | So credit is fair | ✅ built |
| Recurring earnings ledger | So the promise is real | ✅ built |
| Earnings dashboard | So partners trust it | ✅ built |
| Payouts (mobile money/bank) | So they actually get paid | ✅ built, "Cash out" requests a payout that atomically claims the accrued balance (`request_partner_payout` RPC, migration 021); an operator marks it paid |
| Operator tools (agency mode) | A partner who also *runs* the CRM for many shops earns far more, combines referral + operator income | foundation built (migration 019) |
| Leaderboards / status | Gamify the super-connector | later |
| Training / certification | Turn selling into a teachable job | later (ties to skills marketplace) |

---

## Other network effects to layer in

1. **Direct (marketplace) network effect**, every business on wacrm can be
   reached by every partner/operator; every operator can serve every
   business. Two-sided liquidity (operators ⇄ businesses) like any labour
   marketplace.
2. **Data network effect**, every conversation improves the AI's sense of
   what converts in *this* market (which replies close, which prices win).
   More usage → smarter AI → better results → more usage.
3. **Template/skill network effect**, creators publish region- and
   sector-specific skills; each new skill makes the platform more useful to
   the next business, which attracts more creators.
4. **"Powered by" loop**, outbound payment links and (optionally) messages
   can carry a light wacrm tag, so every business unwittingly markets the
   platform to its own customers (some of whom are businesses too).
5. **Financial network effect (later & strongest)**, once we sit in the
   payment flow at scale, verified GMV history underwrites merchant cash
   advances. Capital is sticky: a business borrowing against next week's
   sales does not churn.

The compounding picture: **partners bring businesses → businesses generate
GMV + conversation data → data sharpens the AI + funds bigger partner
payouts → which recruits more partners.** Each loop feeds the next.

---

## Where the code lives

| Part | Location |
| --- | --- |
| Code generation + link building | `src/lib/referrals/codes.ts` |
| Commission split + tiers | `src/lib/referrals/commission.ts` |
| Become-a-partner API | `src/app/api/partners/route.ts` |
| Earnings accrual (in webhook) | `src/app/api/payments/webhook/[provider]/route.ts` |
| Partner dashboard | `src/app/(dashboard)/partner/page.tsx` |
| Signup attribution | `src/app/(auth)/signup/page.tsx` |
| Tables | `supabase/migrations/020_referrals.sql` |
