# Protecting Moldlane from liability

> **Not legal advice.** This is an engineering/operational risk register and
> a checklist of mitigations. Before launch, have a qualified lawyer in each
> operating country review the actual Terms, Privacy Policy, and your
> licences. Treat this as the brief you hand that lawyer.

Moldlane sits in three high-risk positions at once: it **handles personal
data**, it **touches money**, and it **sends automated messages on a
business's behalf**. Each creates a distinct class of liability. Below is
every category we can foresee, who it threatens, and how we reduce it, in
the **product**, in **contracts**, and in **operations**.

---

## 1. The structural shield: corporate + contractual

These come first because they cap everything else.

| Risk | Mitigation |
| --- | --- |
| Personal liability of founders | Operate through a **limited-liability company** (e.g. a Nigerian Ltd / a Delaware C-corp or holding co for international). Never sign as an individual. |
| Unlimited damages from one customer | A **Terms of Service** with: limitation of liability (cap = fees paid in last 1–3 months), exclusion of indirect/consequential damages, and a disclaimer of warranties ("as is"). See `TERMS.md`. |
| "Your AI lost me a sale / sent a wrong price / offended a customer" | **The merchant is the publisher.** Terms state the business is responsible for what goes out under their WhatsApp number; Moldlane is a tool. AI output is "assistive", not guaranteed. Human-in-the-loop is the default for exactly this reason. |
| Disputes escalating to court in many countries | **Arbitration + governing-law clause** pinning disputes to one jurisdiction; class-action waiver where enforceable. |
| Being dragged into the merchant's own legal problems | **Indemnification** clause: the merchant indemnifies Moldlane for claims arising from *their* use, *their* content, and *their* customers. |

---

## 2. Data protection & privacy (the biggest exposure)

Moldlane processes customers' WhatsApp messages, names, phone numbers, and
(via PII detection) sometimes card/ID numbers. This is regulated under
**Nigeria's NDPA 2023**, **Kenya's DPA 2019**, **South Africa's POPIA**,
**Ghana's DPA**, and **GDPR** for any EU data subjects.

**Our legal role:** Moldlane is a **data processor**; the merchant is the
**data controller**. This distinction is the whole defense, the controller
owns the lawful-basis/consent obligation; we process on their instructions.

| Risk | Mitigation | Status in product |
| --- | --- | --- |
| Processing without a Data Processing Agreement | A **DPA** is part of the Terms (controller = merchant, processor = Moldlane), listing sub-processors (Supabase, Meta, OpenRouter/Nvidia, Paystack). | doc todo |
| Leaking customer PII to the AID model | **Redact PII before any LLM call**, already built (`src/lib/safety/pii.ts`, wired into the prompt builders). Card/ID/phone/email are masked. | ✅ built |
| Tenant A reading tenant B's data | **Row-Level Security on every table**; the agency-mode RLS cutover must pass a deliberate two-account leak test before shipping. | ✅ per-user; ⚠ agency-mode cutover pending DB test |
| Secrets/tokens stolen from the DB | WhatsApp tokens **and** payment keys are **AES-256-GCM encrypted at rest**; never returned to the browser. | ✅ built |
| No way to honour deletion / access requests | Build **data export + hard-delete per workspace** (right to erasure). Cascade deletes already model this; add a user-facing action. | todo |
| Cross-border transfer (data leaves the country) | Disclose in the Privacy Policy; prefer **in-region Supabase** where required; note that LLM calls go to the provider's region. | doc + config |
| Indefinite retention | Define a **retention policy** (e.g. purge messages older than N months unless the merchant opts to keep them). | todo |
| Sensitive-data over-collection by the AI | System prompts forbid soliciting card/BVN/passwords; PII guard flags if a customer volunteers them. | ✅ partial |

**Action items (product):** data export + erasure per workspace; a
retention/purge job; a sub-processor list endpoint; finish the agency-mode
RLS leak test.

---

## 3. Payments, money-handling & financial-services risk

Touching money is the fastest route to *regulatory* liability (the kind
that doesn't settle for cash).

| Risk | Mitigation |
| --- | --- |
| Being classified as a **money transmitter / PSP** (needs a CBN/regulator licence) | **Never hold customer funds.** Money flows merchant↔customer through the **licensed PSP** (Paystack/Flutterwave); Moldlane only *initiates* a charge and *reads* a webhook. Our fee is collected via the PSP's own split/settlement, or invoiced, we are not in the flow of funds custody. **This is the single most important boundary; do not cross it without a licence.** |
| Partner commission looks like an unlicensed investment/MLM | The partner programme pays for **referred real revenue only** (a marketing affiliate model), never for recruitment alone, and has no buy-in. Document it as affiliate commission. Avoid "guaranteed returns" language. |
| Chargebacks / fraud | The **PSP owns** chargeback handling and KYC of the merchant. Terms push payment-dispute liability to the merchant + PSP, not Moldlane. |
| Tax (VAT on our fee, partner income) | Issue invoices; have partners accept they're responsible for their own tax; register for VAT where thresholds are met. |
| Misreported earnings to a partner | The **earnings ledger is immutable** (`referral_earnings`), computed by tested integer math, auditable, no float drift. | 
| Wrong amount charged to a customer | The merchant sets the amount; Terms disclaim our liability for merchant-entered figures; receipts are mirrored into the chat for transparency. |

**Bright line:** Moldlane is a **software tool that talks to a licensed
PSP**, not a financial institution. Keep it that way until/unless you
deliberately pursue a licence or an EMI/agent-banking partner.

---

## 4. Messaging, consent & platform-policy risk

Automated WhatsApp messaging is governed by **Meta's WhatsApp Business
Policy** and by anti-spam / consumer-protection law.

| Risk | Mitigation |
| --- | --- |
| Account ban for spam / non-consented broadcasts | Enforce **opt-in**, the **24-hour customer-care window**, and **Meta-approved templates**, already enforced in code. Terms require the merchant to only message people who consented. |
| Merchant uses Moldlane to spam | Terms **prohibit** unsolicited bulk messaging; we reserve the right to suspend. Rate limits already exist. |
| AI sends something defamatory / discriminatory / illegal | Human-in-the-loop default; system prompts forbid it; the merchant is the publisher and indemnifies us; provide a kill-switch (`ai_enabled`), already built. |
| Impersonation | Terms forbid using Moldlane to impersonate; the WhatsApp number is the merchant's own verified business number. |
| Minors / regulated goods (alcohol, pharma, finance) | Terms place compliance on the merchant; consider a prohibited-use list. |

---

## 5. AI-specific risk

| Risk | Mitigation |
| --- | --- |
| AI "hallucinates" a price/policy and the merchant is bound | System prompts forbid inventing prices; replies are grounded in the merchant's business context; **human-in-the-loop is default**; output is labelled assistive, not authoritative. |
| Model-provider outage / change | Provider-agnostic client with **model fallbacks**; degrade gracefully (the ✨ button just fails softly). |
| Provider trains on our prompts | Choose providers/settings that **don't train on inputs** where possible; disclose the sub-processor; PII is redacted regardless. |
| Bias / offensive output | Tone constraints in prompts; reporting path; human review. |
| IP in AI output | Terms: AI output provided "as is"; merchant owns/risks what they send. |

---

## 6. Service, security & operational risk

| Risk | Mitigation |
| --- | --- |
| Downtime causing merchant loss | Terms: **no uptime guarantee** on free/low tiers; SLAs only on paid enterprise plans, with the liability cap. |
| Breach via dependency | Keep dependencies patched (Dependabot already on the upstream); CI typecheck/build; secret scanning. |
| Webhook forgery | **HMAC signature verification** on Meta + PSP webhooks, already built. |
| Insider/admin access | Least-privilege service-role usage; document who can access prod. |
| Open-source licence exposure | The base is **MIT**; keep attribution; audit added dependencies' licences before shipping. |

---

## 7. The launch checklist (do before taking real customers)

- [ ] Incorporate; never contract personally.
- [ ] Lawyer-reviewed **Terms of Service** (cap, disclaimer, indemnity,
      arbitration, governing law, acceptable-use, prohibited-use).
- [ ] Lawyer-reviewed **Privacy Policy** + **DPA** (controller/processor,
      sub-processor list, retention, transfer, data-subject rights).
- [ ] Confirm with a fintech lawyer that the **PSP-only money flow** keeps
      Moldlane out of money-transmitter licensing in each launch country.
- [ ] Ship **data export + per-workspace erasure** and a **retention job**.
- [ ] Pass the **agency-mode RLS two-tenant leak test** on real Postgres.
- [ ] Confirm the chosen LLM provider's **no-training / data-use** terms.
- [ ] Insurance: **professional indemnity + cyber** cover.
- [ ] An incident-response + breach-notification plan (regulator timelines:
      NDPA 72h, GDPR 72h).

---

## 8. What's already done in the product (defence-in-depth)

- PII detection + **redaction before LLM calls** (`lib/safety/pii.ts`).
- **RLS** on every table; tokens & payment keys **encrypted at rest**.
- **HMAC-verified** Meta + PSP webhooks.
- **No fund custody**, money moves through the licensed PSP.
- **Human-in-the-loop default** + AI kill-switch (`ai_enabled`).
- **Immutable, integer-safe** earnings ledger.
- Opt-in / 24-hour window / approved-template enforcement for messaging.

The remaining gaps are mostly **contracts** (Terms/Privacy/DPA) and a few
**product items** (export/erasure, retention, the RLS leak test), all
tracked above.
