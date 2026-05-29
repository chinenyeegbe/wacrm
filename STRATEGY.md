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

### 5. Two ways to make it a business

**a) Sell to businesses (SaaS / managed):**
Offer hosted wacrm with the AI on, tiered by message/AI volume. The free
LLM layer keeps COGS near zero, so even a low monthly price is profitable.
The self-host template stays MIT — it's the funnel.

**b) An operator / agency network ("young Africans get paid"):**
Train young Africans as **CRM operators** who set up and run wacrm for
local businesses (configure WhatsApp, write the knowledge base, manage
broadcasts, watch the inbox). Each operator runs several businesses; the
AI multiplies one person across many accounts. The platform takes a cut of
each managed account and pays operators per account / per outcome. This is
the path with the deepest moat and the most jobs created — and it needs a
**multi-workspace / agency mode** (see next).

### 6. Multi-tenant / agency mode (enables #5b)
The schema is already per-`user_id` with RLS. The work: a workspace/team
layer so one operator account can manage many business workspaces, with
roles (owner / operator / agent) and billing per workspace.

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
