# Moldlane — Privacy Policy & DPA (TEMPLATE / DRAFT)

> **Draft template — not yet legally reviewed. Do not publish as-is.**
> Complete `[…]` fields and have it reviewed under each operating country's
> law (NDPA 2023 · DPA 2019 · POPIA · GDPR). See `LIABILITY.md` §2.

**Provider / processor:** [LEGAL ENTITY]  ·  **Contact / DPO:** [EMAIL]

## Roles
For the data of a business's customers, the **business (merchant) is the
data controller** and **Moldlane is the data processor**, acting on the
merchant's documented instructions. For the merchant's own account data,
Moldlane is the controller.

## What we process
- **Account data:** name, email, password hash, profile.
- **Customer data (on the merchant's behalf):** WhatsApp messages, phone
  numbers, names, and any contact fields the merchant stores.
- **Payment metadata:** amounts, references, status (handled by the PSP;
  Moldlane does not store card details).
- **Usage/technical:** logs needed to run and secure the service.

## How we use it
To provide the service: deliver messages, generate AI replies, organise
contacts/deals, initiate payments, and compute partner earnings. We do
**not** sell personal data.

## AI processing & PII redaction
Message text may be sent to a third-party LLM provider to draft replies.
**We redact detected PII (card numbers, IDs, phones, emails) before sending
text to the model.** We select providers/settings intended **not to train**
on inputs where available.

## Sub-processors
- **Supabase** — database, auth, storage ([region]).
- **Meta (WhatsApp Cloud API)** — message delivery.
- **OpenRouter / Nvidia** — AI model inference.
- **Paystack / Flutterwave** — payment processing.
(The current list is available on request / at [URL].)

## Security
RLS on every table; WhatsApp tokens and payment keys encrypted at rest
(AES-256-GCM); HMAC-verified webhooks; least-privilege server access.

## International transfers
Some processing (e.g. AI inference) may occur outside your country. Where
required we use in-region storage and appropriate transfer safeguards.

## Retention
Account data is kept while the account is active. Customer message data is
retained per the merchant's settings and our retention policy ([N months]
default), then purged, unless the merchant exports/keeps it.

## Your rights
Subject to applicable law: access, correction, deletion ("erasure"),
export/portability, and objection. Account owners can **export** and
**delete** their workspace data from the app; customers should contact the
merchant (controller), who can action requests via Moldlane.

## Breach notification
We will notify affected controllers without undue delay and within
applicable regulatory deadlines (e.g. 72 hours).

## Changes
We may update this policy; material changes will be notified.

---

## Data Processing Agreement (summary terms)
1. Moldlane processes personal data only on the merchant's documented
   instructions and to provide the service.
2. Confidentiality is imposed on personnel with access.
3. Security measures as above; sub-processors as listed, with notice of
   changes and a right to object.
4. Moldlane assists the merchant with data-subject requests and breach
   obligations.
5. On termination, data is deleted or returned at the merchant's choice,
   subject to legal retention.
6. Audit rights and liability as set out in the Terms.
