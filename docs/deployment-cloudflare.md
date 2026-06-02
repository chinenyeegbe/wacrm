# Deploying wacrm to Cloudflare Workers

wacrm runs on Cloudflare Workers via the [OpenNext](https://opennext.js.org/cloudflare)
adapter (`@opennextjs/cloudflare`). The worker is a stateless SSR/runtime
shell — **all data stays in Supabase** (Postgres + Auth + Realtime +
Storage), exactly as on the Hostinger/Node deploy. Moving to Cloudflare
changes only where the front end runs, not your database.

> Compatibility: this is pinned to Next `16.2.6`, which is inside the
> adapter's supported range (`>=16.2.6`). If you bump Next, re-check
> `@opennextjs/cloudflare`'s peer range first.

## 1. Prerequisites

- A Cloudflare account.
- `wrangler` auth: `npx wrangler login`.
- Your existing Supabase project + WhatsApp/Meta credentials.

## 2. Configure

Two files drive the deploy, both committed:

- **`wrangler.jsonc`** — worker name, `nodejs_compat` flag (required:
  the API routes use Node `crypto` for AES-256-GCM token encryption and
  webhook HMAC verification), and the static-assets binding.
- **`open-next.config.ts`** — adapter config. Intentionally empty: no
  Cloudflare KV/D1/R2 cache overrides, so runtime behaviour matches the
  Node deploy.

## 3. Secrets and env vars

Public, build-time values (`NEXT_PUBLIC_*`) can live in `wrangler.jsonc`
under `vars`. **Secrets must never be committed** — set them with
`wrangler secret put`:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ENCRYPTION_KEY
wrangler secret put META_APP_SECRET
# only if you use automation Wait-steps / flow timers:
wrangler secret put AUTOMATION_CRON_SECRET
```

For local Worker testing, copy `.dev.vars.example` → `.dev.vars`
(gitignored) and fill it in.

## 4. Build, preview, deploy

```bash
npm run cf:preview   # build + run the worker locally in wrangler
npm run cf:deploy    # build + deploy to Cloudflare
npm run cf:typegen   # regenerate cloudflare-env.d.ts after binding changes
```

The build runs `next build` first, so the Supabase `NEXT_PUBLIC_*` env
vars must be present at build time (the auth pages prerender a Supabase
client). Set them in your CI/deploy environment.

## 5. Scheduled jobs (cron)

The automation engine's Wait-steps and flow timers are drained by two
endpoints, both guarded by the `x-cron-secret` header matching
`AUTOMATION_CRON_SECRET`:

- `GET /api/automations/cron`
- `GET /api/flows/cron`

The OpenNext worker exports only a `fetch` handler, so a `crons` trigger
in `wrangler.jsonc` would have no `scheduled` handler to run. Drive them
one of two ways:

**Option A — a separate Cron Worker (recommended).** A tiny standalone
worker on a `crons` schedule that fetches your deployed endpoints with
the secret header:

```js
// cron-worker/src/index.js  (deploy as its own worker)
export default {
  async scheduled(_event, env) {
    const headers = { "x-cron-secret": env.AUTOMATION_CRON_SECRET };
    await Promise.all([
      fetch(`${env.APP_URL}/api/automations/cron`, { headers }),
      fetch(`${env.APP_URL}/api/flows/cron`, { headers }),
    ]);
  },
};
```

```jsonc
// cron-worker/wrangler.jsonc
{
  "name": "wacrm-cron",
  "main": "src/index.js",
  "compatibility_date": "2025-03-25",
  "triggers": { "crons": ["*/5 * * * *"] },
  "vars": { "APP_URL": "https://crm.example.com" }
}
```

(`wrangler secret put AUTOMATION_CRON_SECRET` on this worker too.)

**Option B — any external pinger** (cron-job.org, GitHub Actions
schedule, etc.) hitting the two URLs every few minutes with the
`x-cron-secret` header. This is host-agnostic and works identically to
the current Node deploy.

## 6. Caching note

The `Cache-Control` rules in `next.config.ts` were written to work around
a **Hostinger CDN** quirk (it cached prerendered HTML for a year and
broke chunk hashes on redeploy). Cloudflare's cache semantics differ; the
hashed `/_next/static/*` immutable rule still applies, but you can manage
HTML/edge caching with Cloudflare Cache Rules instead. Nothing here blocks
a deploy — revisit it once you're on Cloudflare.
