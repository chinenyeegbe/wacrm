# Moldlane — Plan, Backlog, and Mobile Strategy

**Date:** July 2026
**Builds on:** `docs/STRATEGIC_AUDIT.md` (the strategy) and everything shipped since (PRs #4–#10: RLS/webhook/cron hardening, opt-out, indexed contacts, zod, the server-side broadcast runner, scheduling, playbook audiences, the recovered-revenue counter, automated playbooks).
**Trigger for this doc:** a Podium comparison, a "do we have reactivation" check, and a walk-through of Sam-the-mechanic's actual journey surfaced the concrete gaps. This is the plan to close them — including a mobile experience, which didn't exist as a plan item until now.

---

## 1. Where we actually stand

**Fully built and merged:** shared inbox, contacts + job records (`last_service_date`, `service_type`, `job_value`, `next_due_date`), template broadcasts, a resumable server-side send/scheduling engine, three smart audiences (service-due / recently-served / dormant), automated recurring **Playbooks** with cooldowns, opt-out/STOP compliance, and a recovered-revenue counter with a one-tap confirm queue. This is a real, working reactivation product — more complete on the automation side than most competitors' bolt-on "campaigns" features.

**The two gaps that matter most, in order:**

1. **No review-request / reputation feature.** This is Podium's entire original wedge and the single most-requested proof-point for "is this like Podium." We have the exact primitive to build it (`recently_completed` audience + playbook engine) and haven't yet.
2. **No mobile experience.** The app is a responsive web dashboard only — no installable app, no push notifications, no offline resilience. For an owner-operator who is on a job site, in a van, or under a car all day, "log into a website" is a real adoption barrier the audit didn't originally scope but should have.

Everything else missing (Paddle billing, Meta Embedded Signup, live Sentry, payments-in-chat, multi-location) is either account-gated (needs your keys/approvals) or deliberately deferred per the audit's sequencing (§7, §10).

---

## 2. The backlog, prioritized

Ranked by (revenue-loop impact × how much it closes the Podium/credibility gap) ÷ effort. "P0" = do next; "P1" = this quarter; "P2" = next 6–12 months; "P3" = only if demand proves it.

### P0 — close the credibility and adoption gaps

| # | Item | Why now | Rough size |
|---|---|---|---|
| P0.1 | **Review-request playbook** — `recently_completed` audience + a review-ask template + Google review link field on `whatsapp_config` or a new `business_profile` row | Closes the single biggest Podium gap; reuses 100% of existing infrastructure (playbook engine, broadcast runner, opt-out) | Small — mostly a template + one settings field + wiring the audience type that already exists |
| P0.2 | **Starter template library** — 3–6 pre-written, Meta-submission-ready templates (reactivation, service-due, review-ask) per trade (garage, plumber/heating, cleaner) that a new playbook can pick and submit with one click | Removes the "I don't know what to write" wall between signup and first campaign; directly shortens Sam's journey (identified in the walkthrough) | Small–medium (content work + a submit-to-Meta UI hook that mostly exists in Settings → Templates already) |
| P0.3 | **Mobile experience — Progressive Web App (PWA)** | See §3. Fastest path to "usable from a phone," matches the existing stack, no new runtime | Medium |
| P0.4 | **Bulk job-record import** — extend CSV contact import to accept `last_service_date` / `service_type` / `job_value` / `next_due_date` columns | Today these are single-contact-at-a-time edits; a business with 500 customers won't hand-enter this, which starves every playbook of data | Small |
| P0.5 | **Concierge onboarding checklist for the founder** (internal, not customer-facing) — a lightweight ops runbook/skill for doing the Meta WhatsApp setup *for* a new customer, since Embedded Signup isn't ready | De-risks the #1 adoption barrier without waiting on Meta approval | Small (mostly docs/skill, some may already exist in `.claude/skills`) |

### P1 — this quarter, once P0 is proving itself

| # | Item | Why |
|---|---|---|
| P1.1 | **Paddle billing** (behind your sandbox keys) — subscription + setup fee, EU/UK VAT handled by Paddle as merchant-of-record | Audit §10: "charge from customer one." Currently free — no willingness-to-pay signal |
| P1.2 | **Meta Embedded Signup** (start the Tech Provider application now — it takes weeks) | Removes the manual Meta credential-paste step that is a hard wall for a non-technical trade owner |
| P1.3 | **Live error tracking (Sentry attach)** — the `setErrorReporter` hook already exists in `src/lib/observability.ts`; just needs a DSN and the SDK wired at startup | Cheap, closes a real operability gap before real customer traffic |
| P1.4 | **Push notifications for new messages/replies** (ships as part of the PWA — see §3) | An owner who doesn't see a reply for 6 hours loses the "recovered revenue" moment; this is retention-critical, not a nice-to-have |
| P1.5 | **Review-reply visibility** — surface incoming Google review notifications or at least a manual "log a review" action tied to the review playbook, so the loop closes (ask → review posted → counted) | Completes the review feature into a real loop, not just an ask |

### P2 — 6–12 months, once there's real usage data

| # | Item | Why deferred |
|---|---|---|
| P2.1 | AI-drafted reply suggestions in the inbox | Needs volume/data to be worth the integration; audit explicitly calls AI phase 2 |
| P2.2 | AI-personalized playbook copy per contact (not just per playbook) | Same — earn the data first |
| P2.3 | Payments-in-WhatsApp (deposit/booking links) | Podium has this; real feature but a genuinely separate integration (a payments processor) — not worth building before billing itself is proven |
| P2.4 | Native mobile app (see §3) — only if PWA adoption data shows real demand for capabilities a PWA can't give (deep background push reliability on iOS, native camera/contacts integration) | Native is 5–10× the PWA's cost; don't pre-pay for it |
| P2.5 | Internal admin/ops view (all tenants, campaign health, Meta quality ratings) | Useful once there are enough customers that eyeballing Supabase directly stops working |

### P3 — only if a specific customer/segment demands it

- Multi-seat teams / org model (today's single-user tenancy is *correct* for the ICP; the audit is explicit — don't build this speculatively)
- Multi-location / franchise support
- Webchat widget

---

## 3. Mobile experience — the actual plan

You asked for mobile to be "built in." Here's the honest tradeoff and the recommendation.

### The three options

| Option | What it is | Cost | What you get |
|---|---|---|---|
| **A. Responsive web only (today)** | The existing Next.js dashboard, works in any mobile browser | Already done | Usable, but feels like "a website," no app icon, no push, no offline |
| **B. Progressive Web App (PWA)** | Add a web manifest + service worker to the *existing* app. User taps "Add to Home Screen" and gets an app icon, full-screen launch, offline shell, and push notifications (via web push) | **Days, not months** — no new codebase, no app-store process, ships inside the existing Next.js/Cloudflare stack | App-like feel, installable, push notifications for new replies. **iOS limitation:** web push on iOS Safari only works if the PWA is installed to the home screen first (since iOS 16.4+, this works but isn't automatic — users must add it manually once) |
| **C. Native app (React Native / Expo, or Capacitor wrapping the web app)** | A real iOS/Android app in the App Store / Play Store | **Weeks to months**, ongoing app-store maintenance, separate release cadence, Apple Developer + Google Play accounts | Best possible mobile UX, most reliable push, native camera/contacts access — but a second codebase (or a Capacitor wrapper, which is a lighter version of this) to maintain |

### Recommendation: **Option B (PWA) now, Option C only if proven necessary**

This matches the audit's own philosophy (§10, §3.3: "the simplest possible version," "earn the data before automating"). Concretely:

1. **Add a web app manifest** (`public/manifest.json` — name, icons, `display: standalone`, theme color matching the existing brand palette) and register a minimal service worker for an offline app shell. Next.js supports this directly; no new framework needed.
2. **Web push notifications** for: new inbound message, campaign reply (ties directly into the recovered-revenue loop — "someone replied to your reactivation text" should reach Sam's phone the moment it happens, not whenever he next opens a laptop).
3. **Mobile-first polish pass** on the three screens a phone-using owner actually lives in day to day: **Inbox** (already responsive), **Dashboard** (recovered-revenue card + confirm queue — should be the first thing that loads), and **Playbooks** (glance-and-toggle, not a desktop form). The sidebar already collapses to a mobile drawer, so most of the shell work is done; this is about information density and touch targets on the content, not rebuilding navigation.
4. **"Add to Home Screen" prompt** in onboarding — a one-time nudge after first login on a mobile browser, so Sam actually gets the app-icon experience without hunting for it in a browser menu.

**When to revisit native (Option C):** once there are real customers using the PWA daily, if push reliability or specific native capability (e.g. tap-to-call directly from a contact, camera-first photo capture for before/after job photos) becomes a repeated, specific complaint — not before. Building a native app before product-market fit is exactly the kind of premature investment the audit warns against.

---

## 4. Sequencing — the next 30/90 days

**Next 30 days (P0):**
- Ship the review-request playbook (P0.1) and starter template library (P0.2) together — they're the same underlying feature (a playbook + a template), just different copy and audience defaults.
- Ship the PWA manifest + service worker + push notifications (P0.3).
- Bulk job-record CSV import (P0.4).
- Document/ship the concierge-onboarding runbook (P0.5) — this can be a same-day addition to `.claude/skills/`.

**Next 90 days (P1):**
- Paddle billing behind your sandbox keys (hand them over whenever ready — this can start in parallel with the above).
- Kick off the Meta Embedded Signup / Tech Provider application now (long external lead time — don't wait to start it).
- Sentry DSN + attach.
- Push notifications live end-to-end; review-reply visibility closes the loop.

**6–12 months (P2):** AI reply drafting and personalized playbook copy, once there's enough usage data to make them worth building; payments-in-chat; admin/ops view; native app only if the PWA data justifies it.

---

## 5. What I need from you to keep moving

- **Paddle sandbox keys** (P1.1) whenever ready.
- **Confirm the Meta Tech Provider application is started** on your side, or say if you want me to draft the application materials.
- **A decision on P0.1's review-ask copy tone** per trade (garage vs. plumber vs. cleaner) — I can draft all three using the `playbook-message` skill; a quick look/approval from you before they go to Meta for template approval would be good given they're customer-facing and irreversible once sent.
- Green light to start P0.1–P0.4 as the next PR(s) — my default is to proceed with these since they're pure product work with no account dependencies, unless you want to reorder.
