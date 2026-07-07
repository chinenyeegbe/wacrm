# Deploying Moldlane on Cloudflare

This app is **Next.js 16 (App Router) with middleware + server
components + Supabase SSR**. That combination does **not** run on plain
Cloudflare Pages static hosting — it needs the OpenNext Cloudflare
adapter, which runs Next on Cloudflare Workers. This guide covers the
two things that most often break a deploy:

1. **Missing environment variables** → every request 500s (the
   middleware needs the Supabase keys). The app now fails *soft* when
   the public keys are missing (marketing + login pages still render),
   but the CRM itself won't work until they're set.
2. **No Workers adapter** → the build deploys but server routes /
   middleware don't execute.

---

## 1. Set environment variables

In **Cloudflare → your project → Settings → Variables and Secrets**, add
(see `.env.local.example` for full notes):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | From Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Secret — server only |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `META_APP_SECRET` | ✅ | Meta → App Settings → Basic |
| `NEXT_PUBLIC_SITE_URL` | recommended | e.g. `https://app.moldlane.com` |
| `AUTOMATION_CRON_SECRET` | ✅ if using automations/flows | Shared secret for the scheduler endpoints (see §4). Any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> Mark the non-`NEXT_PUBLIC_*` ones as **encrypted/secret**.

## 2. Set up Supabase

1. Create a Supabase project.
2. Apply every migration in `supabase/migrations/` in order (Supabase
   SQL editor, or the Supabase CLI: `supabase db push`).
3. Copy the URL + anon + service-role keys into the env vars above.

## 3. Build for Cloudflare Workers (OpenNext adapter)

**This is already wired up in the repo** — `@opennextjs/cloudflare` +
`wrangler` are in `devDependencies`, with `wrangler.jsonc`,
`open-next.config.ts`, and `cf:*` npm scripts. Crucially, `wrangler.jsonc`
has a `build.command` of `npx opennextjs-cloudflare build`, so **wrangler
generates `.open-next/worker.js` itself** right before it uploads —
the Workers Builds integration works with its default commands, no
dashboard changes required.

> **Optional tidy-up:** the default Workers Builds *build command* is
> `npm run build` (a plain `next build`), which is now redundant since
> wrangler rebuilds via OpenNext during upload. To avoid building twice,
> set the dashboard **Build command** to empty (or `echo skip`) and
> leave the **Deploy command** as `npx wrangler versions upload` /
> `npx wrangler deploy`.

That produces `.open-next/worker.js` and deploys it using
`wrangler.jsonc`. To do it from your machine instead:

```bash
npx wrangler login
npm run cf:deploy        # builds with OpenNext, then wrangler deploy
# or just preview locally on the Workers runtime:
npm run cf:preview
```

Point `app.moldlane.com` at the Worker under **Custom domains**.

> Note: the default "Workers Builds" command (a plain `next build` /
> framework auto-detect) is what was failing — Next.js middleware + SSR
> can't run as a static build. Switching the build command to
> `npx opennextjs-cloudflare build` is the fix.

Reference: <https://opennext.js.org/cloudflare>

---

## 4. Provision the scheduler (cron)

Automations and Flows depend on two endpoints being hit on a schedule —
the app **cannot** fire them itself:

| Endpoint | Job |
| --- | --- |
| `GET /api/automations/cron` | Drains due automation `wait` steps so paused automations resume. |
| `GET /api/flows/cron` | Sweeps abandoned flow runs past their timeout. Without it, a stale run pins the one-active-run-per-contact index and blocks new triggers for that contact **forever**. |
| `GET /api/broadcasts/cron` | Sends queued and scheduled broadcasts. The wizard only enqueues; without this endpoint running, broadcasts never send. |
| `GET /api/playbooks/cron` | Runs automated playbooks (daily): resolves each playbook's audience, skips cooldown contacts, and enqueues a broadcast. Run it just before the broadcasts endpoint. |

Both require the `x-cron-secret` header to equal `AUTOMATION_CRON_SECRET`
(constant-time checked) and return `503` if the secret is unset. A
5-minute cadence is ample (flow timeouts default to 24h).

Pick **one** scheduler:

**Option A — GitHub Actions (simplest).** The repo ships
`.github/workflows/cron.yml`. Add two repository secrets and it runs on
GitHub's schedule:

- `APP_URL` — e.g. `https://app.moldlane.com` (no trailing slash)
- `AUTOMATION_CRON_SECRET` — the same value set in the app's env

**Option B — Cloudflare Workers Cron Triggers (most robust).** Requires
a custom Worker entrypoint that adds a `scheduled()` handler wrapping the
OpenNext-generated `.open-next/worker.js` default export, plus a
`triggers.crons` array in `wrangler.jsonc`. This keeps the schedule on
the same platform as the app but changes the build entrypoint — validate
it against a preview deploy before relying on it. See
<https://opennext.js.org/cloudflare> for the current custom-worker
pattern.

**Option C — any external cron / uptime pinger** hitting the two URLs
with the `x-cron-secret` header on a 5-minute interval.

---

## 5. Optional: cross-isolate rate limiting (KV)

The per-user API rate limits (`/api/whatsapp/send`, `/broadcast`,
`/react`) default to an **in-memory** counter. On Cloudflare Workers
each isolate has its own memory, so under load the limit is enforced
per-isolate, not globally.

To share the counter across every isolate, bind a KV namespace named
`RATE_LIMIT_KV`. The app auto-detects the binding and switches to it; if
it's absent (or KV errors), it falls back to the in-memory limiter, so
this is purely opt-in.

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

Then add the returned id to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "RATE_LIMIT_KV", "id": "<the-id-wrangler-printed>" }
]
```

> Best-effort by design: KV has no atomic increment, so two exactly
> simultaneous requests can under-count by one. That's fine for coarse
> abuse limits; the failure mode is slightly permissive, never a
> lockout.

---

## 6. Verify

- `https://app.moldlane.com/` → **marketing landing page** (business).
- `https://app.moldlane.com/agents` → **agent program** page.
- `https://app.moldlane.com/login` → sign-in.
- Sign up, log in, and you land on `/dashboard` with the **Get set up**
  onboarding checklist.

## Local testing (before deploying)

```bash
cp .env.local.example .env.local   # fill in the values above
npm install
npm run dev                         # http://localhost:3000
```

To test WhatsApp template flows without a live Meta account, set
`WHATSAPP_TEMPLATES_DRY_RUN=true` in `.env.local`.
