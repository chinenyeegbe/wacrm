---
name: playbook-message
description: Draft a Meta-compliant WhatsApp template message for a Moldlane playbook (reactivation, service-due reminder, or review request) in a specific business's voice, with opt-out handling baked in. Use when writing or reviewing customer-facing WhatsApp campaign copy.
---

# Draft a playbook WhatsApp template

Write WhatsApp **marketing template** copy for one of Moldlane's three
playbooks, ready to submit to Meta for approval. The message is sent
*from the business's own WhatsApp number to their own past customers* —
it must sound like the tradesperson, never like software.

## Inputs to collect

- Playbook: **reactivation** (dormant customer win-back), **service-due**
  (MOT / boiler service / seasonal reminder), or **review-request**
  (post-job Google review ask)
- Business name, trade, and town
- Their voice: 2–3 example messages they'd normally send customers
  (or ask 3 quick questions: formal or matey? emojis or none? how do
  they sign off?)
- The offer, if any (e.g. "£10 off an MOT booked this month")
- For review-request: their Google review link
- Template variables available: {{1}}, {{2}}, … map to contact fields
  (name, service type, due date, etc.)

## Hard rules (Meta policy + UK PECR — non-negotiable)

1. **Opt-out line in every marketing template.** End with a short
   opt-out, e.g. "Reply STOP to opt out." (The app's webhook honours
   STOP automatically — see `src/lib/whatsapp/opt-out.ts`.)
2. **Identify the business by name** in the first line — the customer
   must instantly know who's messaging.
3. **Existing customers, similar services only** (PECR soft opt-in).
   Never draft copy aimed at purchased lists or strangers.
4. Body ≤ 550 characters. WhatsApp templates render plainly — no
   markdown headers, no link shorteners (Meta flags them).
5. No pressure tactics, no fake urgency, no ALL CAPS.
6. Honest framing: "it's been a while", not "your warranty is void".

## Voice rules

- Write like the tradesperson texts: contractions, short sentences,
  first person ("I" for sole traders, "we" for teams).
- One idea per message. One clear ask.
- Personalise with {{1}} (name) at minimum; reference the actual
  service where the data exists ("your boiler service", "the Corsa").

## Structure per playbook

- **Reactivation:** who we are → the gap ("it's been about {{2}} since
  we last saw you") → easy ask ("want me to pencil you in?") → offer if
  provided → opt-out.
- **Service-due:** who we are → the specific clock ("{{2}} is due
  {{3}}") → the consequence framed helpfully (legal for MOT, warranty
  for boiler) → one-tap ask → opt-out.
- **Review-request:** thanks for the specific job → the ask with the
  link → why it matters ("small local business, reviews are everything")
  → opt-out. Keep this one shortest of all.

## Output format

For the chosen playbook, produce:

1. **Template body** (with {{n}} variables) — the exact text to submit
   to Meta, inside a code block.
2. **Variable map** — what each {{n}} should be filled with per contact.
3. **Category to select:** MARKETING (all three playbooks are marketing
   under Meta's rules — utility miscategorisation gets rejected).
4. **Two alternates:** one warmer, one shorter.
5. **A 1-line note on timing** (when this trade's customers actually
   read messages — e.g. trades' customers: early evening; garages:
   weekday mornings).
