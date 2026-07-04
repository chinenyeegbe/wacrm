---
name: qualify-service-business
description: Score a prospective customer (a local service business) against Moldlane's ICP and return a go/no-go with reasoning. Use when evaluating whether a plumber, garage, cleaner, electrician, or similar trade business is worth a sales visit or demo.
---

# Qualify a service business against Moldlane's ICP

You are qualifying a prospective **Moldlane customer** — a local service
business — against the ICP defined in `docs/STRATEGIC_AUDIT.md` §4.
Moldlane's promise is *recovering repeat revenue from customers the
business already has*, so qualification is about repeat-revenue
potential, *not* company size or polish.

## Inputs

Ask the user for whatever subset of this they have (do not block on
completeness; score with what exists and mark unknowns):

- Business name, trade, and location
- Roughly how many past customers they have (phone book, job sheets,
  invoicing tool, spreadsheet)
- Whether the service recurs (annual/seasonal/contract) or is one-off
- How they talk to customers today (WhatsApp? SMS? phone only?)
- Team size and who answers the phone
- Whether they have slow days / spare capacity

## Scoring — the five ICP criteria

Score each 0–2 (0 = fails, 1 = unknown/partial, 2 = clear pass):

1. **Customer list ≥ ~200 past customers with phone numbers.** This is
   the hard qualifier — no list, no reactivation, no value.
2. **Calendar-driven repeat service.** MOT (annual, legally required),
   boiler service (annual), cleaning (weekly/monthly), landscaping
   (seasonal), maintenance contracts. One-off trades (roofing, bathroom
   fits) score 0–1: their value is referrals, which is a later playbook.
3. **WhatsApp is already their customer channel** — they quote,
   confirm, and receive photos over WhatsApp today.
4. **Owner-operator, 1–10 staff, owner answers the phone.** One
   decision-maker who personally feels the pain of missed follow-ups.
5. **Spare capacity.** Slow days exist, so recovered demand is pure
   margin rather than a scheduling problem.

## Anti-ICP — automatic no-go regardless of score

- They want **lead generation** ("get me new customers") — wrong promise.
- Franchise / multi-location — sales cycle too long for now.
- No customer list at all and no way to build one.
- Businesses where a booking-app incumbent already owns reminders
  (salons/beauty on Treatwell-style platforms).

## Output format

```
## <Business name> — <QUALIFY | NURTURE | PASS>

Score: <n>/10

| Criterion | Score | Evidence |
|---|---|---|
| Customer list | | |
| Repeat-service clock | | |
| WhatsApp-native | | |
| Owner-operator | | |
| Spare capacity | | |

**Verdict reasoning:** <2–3 sentences>
**If QUALIFY — the pitch math:** estimate recoverable revenue:
(dormant customers ≈ 60% of list) × (expected reactivation rate
10–20%) × (average job value). State assumptions.
**If NURTURE:** what would change the verdict, and when to revisit.
```

Thresholds: 8–10 QUALIFY, 5–7 NURTURE, 0–4 PASS. Any anti-ICP hit is an
automatic PASS with the reason stated. Be blunt; an honest PASS saves a
wasted visit.
