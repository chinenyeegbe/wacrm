# wacrm → an AI growth engine for African business

This document is the plan for turning wacrm (a self-hostable WhatsApp CRM)
into a product that gives any African business an unfair advantage — and a
business that can grow on top of it. It is deliberately honest about what
is **built today** versus what is **next**, so it can be executed
incrementally without hand-waving.

## Why WhatsApp + Africa + AI

- WhatsApp is the default commerce channel across the continent. Customers
  DM to ask prices, negotiate, and pay. The shop floor is a chat thread.
- Most SMBs run that thread out of one phone, manually, with no memory, no
  follow-up, and no analytics. That is the gap.
- An AI that reads the thread, drafts the reply in the customer's own
  language, never forgets a lead, and markets the business while the owner
  sleeps is a genuine superpower — and it now runs on **free** LLMs, so the
  unit economics work even at a ₦/KSh price point.

## What is built today (this session)

A working AI layer that runs on free models (OpenRouter / Nvidia
Nemotron), wired into the product:

- **Suggest reply** and **Rewrite draft** in the inbox (✨ button).
- **AI endpoint** (`/api/ai`) that also drafts broadcast campaigns and
  social posts — the seed of "the product markets itself."
- Africa-aware prompting: matches the customer's language and register
  (Pidgin, Swahili, French, Hausa, Yoruba, Arabic, Zulu, …), keeps
  replies WhatsApp-short, never invents prices.
- Server-side keys, auth, and per-user rate limiting.

See [`docs/ai.md`](docs/ai.md) to switch it on.

## The roadmap (in priority order)

Each item is scoped to be a self-contained PR on top of what exists.

### 1. AI in automations — "it works while you sleep"
Add an **AI step** to the no-code automation builder (the engine already
supports typed steps in `src/lib/automations/`). Triggers like "new
inbound message" → AI step → "send message" gives an auto-responder that
qualifies leads, answers FAQs, and books calls 24/7. Add a per-workspace
**business context** field (catalogue, prices, hours) so the AI answers
accurately. This is the single highest-leverage feature.

### 2. Knowledge base / RAG
Let the owner paste their catalogue, price list, and policies. Store as
embeddings (pgvector in Supabase) and retrieve into the prompt. Now the AI
quotes real prices and stock — the difference between a toy and a closer.

### 3. The product markets itself
- A **"Generate campaign"** wizard: brief in, broadcast + social posts
  out (the `draft_broadcast` / `draft_social` actions already exist).
- A built-in **referral mechanic**: every outbound broadcast can carry a
  "powered by" link; referred sign-ups credit the referrer. This is the
  organic growth loop.
- A weekly **AI digest**: the system summarises the week's conversations,
  flags hot leads, and proposes next actions — delivered to the owner's
  own WhatsApp.

### 4. It improves itself (safely)
"Self-improving" done responsibly means a tight feedback loop, not
unsupervised self-editing:
- Log which AI suggestions the agent **sent as-is vs edited vs discarded**
  (a thumbs-up signal). Use it to tune prompts and pick better models.
- A/B the model fallback order by win-rate and latency.
- Surface analytics: response time, conversion by stage, best-performing
  copy — so the human operator (you) compounds improvements each week.
  Genuine autonomous code-change should stay gated behind human review.

### 5. How we make money

**The hard truth about African SMB monetization:** most merchants hate
(or can't afford) subscriptions, but they'll happily share a commission
*if you helped them earn it*. The trap is that a commission you can't
**collect** is just a wish — payment usually happens off-platform (bank
transfer, cash on delivery, mobile money), so most "rev-share" models
can't see or take their cut.

So the entire monetization design bends around one principle:

> **To earn a commission we must sit in the payment flow. The AI doesn't
> just close the sale — it collects the money.**

#### Primary model: transaction commission ("we eat only when you eat")
The AI, mid-conversation, generates a **payment request** (Paystack /
Flutterwave / M-Pesa / mobile-money link or USSD push) for the agreed
amount. The customer pays through it; settlement routes to the merchant
**minus a small platform fee** (target ~1–3% of GMV, on top of the PSP's
own fee). Because the money moves through our generated link, the
commission is collected automatically — never invoiced, never chased.

Why merchants accept it:
- Zero upfront cost. No subscription. The fee only exists when a sale
  closes — money they wouldn't have had if the lead went cold at 11pm.
- It's framed as "the AI sold this for you," not "rent." Aligned, not
  extractive.
- They get instant proof of value: "wacrm closed ₦340k for you this week"
  is the only sales pitch we ever need.

This is the flywheel: **better AI → more closed sales → more GMV → more
commission**, with our COGS still near zero (free LLMs).

#### Secondary models (layer on once #1 works)
- **Subscription — for those who prefer it.** Medium/large companies and
  agencies often *want* a flat fee for predictability and will pay for
  seats, volume, multi-number, analytics, and SLAs. Offer it as an
  *option*, not the default. A merchant doing high GMV can also opt into a
  flat plan to cap commission — both paths are profitable.
- **Float / payments margin.** Standard PSP economics — a thin spread on
  processing — once volume justifies negotiating rates.
- **Value-added, pay-per-use.** Bulk broadcast credits, premium templates,
  AI ad-creative generation, a "boost" that drafts and schedules a week of
  marketing. Small à-la-carte spend Africans *do* tolerate (airtime-style).
- **Capital, eventually.** Verified GMV history through our rails is an
  underwriting signal — merchant cash advances ("borrow against next
  week's sales"). High-trust, high-margin, and only possible *because* we
  sit in the flow. Far-future, but it's where the real money is.

#### The operator network's economics (ties to 5b below)
Operators are paid **per closed-sale commission share**, not a salary —
so their incentive is identical to ours and the merchant's: close more,
earn more. The platform takes its cut of GMV, pays the operator their
share, keeps the rest. Nobody pays a subscription; everybody gets paid
when sales happen.

#### What this requires us to build (priority order)
1. **Payments module** — ✅ shipped. PSP-agnostic provider layer
   (Paystack, Flutterwave, manual bank/mobile-money), `payment_config` +
   `payment_requests` tables (migration 011, RLS'd, fee in basis points),
   a signed PSP webhook that flips pending→paid and mirrors a confirmation
   into the inbox, and a Settings → Payments UI (encrypted keys).
2. **`request_payment` automation step** — ✅ shipped. Mints a link via the
   merchant's provider and sends it on WhatsApp; amount can read
   `{{vars.amount}}` set by an upstream AI step. Plus an "AI Close &
   Collect" template (classify → buying? → confirm → link).
3. **Attribution** — ✅ shipped. Each `payment_request` stores
   `conversation_id` + `automation_id` and the `platform_fee_minor` taken,
   so "the AI closed this" and the commission are provable and auditable.

Still open: a **commission ledger / payout** view aggregating
`platform_fee_minor` per period, and **operator split** accounting (needs
agency mode, below).

> Sequencing note: ship the AI that *closes* (auto-responder ✅, qualifier
> next), then the payments rail that *collects*. Closing without
> collecting is a great demo; collecting is the business.

### 5b. Two go-to-market motions

**Sell to businesses (mostly commission, optional subscription):**
Hosted wacrm with AI + payments on. Default to transaction commission;
offer flat plans to companies that prefer them. The self-host template
stays MIT — it's the top-of-funnel, not the revenue.

**An operator / agency network ("young Africans get paid"):**
Train young Africans as **CRM operators** who set up and run wacrm for
local businesses (configure WhatsApp, write the knowledge base, manage
broadcasts, watch the inbox, close sales). Each operator runs several
businesses; the AI multiplies one person across many accounts. Operators
earn a share of the commission they help generate. Deepest moat, most jobs
created — needs **multi-workspace / agency mode** (see next).

### 6. Multi-tenant / agency mode (enables 5b) — NEXT
The schema is already per-`user_id` with RLS. The work: a workspace/team
layer so one operator account can manage many business workspaces, with
roles (owner / operator / agent) and commission accounting per workspace.

This is deliberately its **own** change set, not bundled with feature
commits — it rewrites the RLS trust boundary (from "row owner = user" to
"row belongs to a workspace the user is a member of"), and a mistake there
leaks one merchant's chats to another. Plan:
1. `workspaces` + `workspace_members(role)` tables; every tenant table
   gains a `workspace_id`; backfill `workspace_id` from `user_id`.
2. Swap RLS predicates to `workspace_id IN (my workspaces)`.
3. A workspace switcher in the UI; invites; per-workspace commission split.
Ship behind a flag, migrate existing single-user accounts to a personal
workspace transparently.

### 7. Human-in-the-loop is the product, not a fallback
The AI is an **assistant to a human operator**, never an unattended bot.
The loop we're building toward:
- AI triages every inbound (`ai_classify`, shipped) and routes the ones
  that need judgement to the *right* human (round-robin shipped; skills-
  based routing next).
- The human oversees, edits, approves — and can hand sub-tasks to agents
  (their own staff, or marketplace operators) and gets paid out of the
  value created, paying helpers from the same flow. A self-sustaining
  circular market: the operator earns the spread between what the work is
  worth and what they pay to get it done — with AI doing most of the
  typing so that spread is wide.

### 8. Trust & safety (a feature, and a sellable skill)
African SMB relationships run on trust; mishandling a customer's details
breaks it instantly. Shipped this batch:
- **PII / sensitive-content detection** (`src/lib/safety/pii.ts`):
  card numbers (Luhn-checked), emails, phones, long ID numbers. Pure and
  synchronous — cheap enough to run on every inbound message.
- **Redaction before any LLM call** — the AI prompt builders now strip PII
  from the transcript, so a customer's card/BVN never leaves the box even
  though replies are drafted by an external model.
Next: surface a "⚠ sensitive info" flag on flagged messages in the inbox,
an `ai_classify`-style `flag_sensitive` signal automations can branch on,
and per-business rules ("never share a customer's phone with X").

### 9. Re-engagement / win-back
Dormant clients are the cheapest revenue a business has. Shipped: a
**Win-Back** template — tag a past customer `win-back` and the AI sends a
warm, non-pushy reconnect message, then hands the reply to a human. Next:
a scheduled "haven't heard from these N contacts in 90 days → win-back"
audience, and a small returning-customer offer mechanic.

### 10. Creator / skills marketplace
Independent creators as first-class businesses on the platform:
- **Sell automation templates** — automations are already portable data
  and the install-from-template plumbing exists; needs a user-authored
  registry + a safety review (templates can contain `send_webhook` /
  `request_payment`, so listing must be gated).
- **Sell skills** — reusable, domain-deep prompt packs that plug into
  `ai_reply` / `ai_classify`: negotiation, specific government
  certification/paperwork flows, sector and cultural nuances that differ by
  business and region. These are where real expertise (and pricing power)
  live.
- **Earn commission on outcomes** — a creator runs agents for merchants and
  is paid a share of what those agents *collect* (the payments rail makes
  this measurable). Needs agency mode (#6) + a commission ledger.
The marketplace is phase-2; its prerequisites are payments (done) and
agency mode (next).

## Operating it independently (handoff)

What you (the human operator) provide and how it maps to growth:

| You provide        | Used for                                              |
| ------------------ | ---------------------------------------------------- |
| Hosting + domain   | Deploy (Hostinger one-click is wired in the README). |
| Supabase project   | Database, auth, storage, realtime.                   |
| OpenRouter key     | The AI layer — free models, $0 to start.             |
| Meta WhatsApp app  | The actual messaging channel.                        |
| Payments account   | Subscriptions (SaaS) and operator payouts.           |
| Social accounts    | Distribution for the AI-generated marketing copy.    |

Suggested first 30 days, solo:
1. Deploy, connect WhatsApp, add the OpenRouter key.
2. Onboard **one** real business you know. Make the inbox + AI replies
   genuinely save them time. Get a testimonial.
3. Use `draft_social` to post daily about that result. Funnel DMs into the
   same wacrm. (The tool sells itself by being the thing you sell with.)
4. Onboard 5 more. When inbox-watching becomes the bottleneck, recruit
   your first operator and build agency mode (#6).

## Guardrails

- Keep the self-host template MIT and free — it is the top of the funnel,
  not the revenue.
- Never auto-send AI messages without either explicit human approval or an
  automation the owner consciously turned on. Trust is the whole product.
- Respect WhatsApp's policies (opt-in, 24-hour window, approved templates)
  — they are already enforced in the codebase; don't route around them.
- Don't impersonate anyone or send unsolicited bulk messages. Growth comes
  from genuinely useful automation, not spam.
