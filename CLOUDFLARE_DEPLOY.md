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

> Mark the non-`NEXT_PUBLIC_*` ones as **encrypted/secret**.

## 2. Set up Supabase

1. Create a Supabase project.
2. Apply every migration in `supabase/migrations/` in order (Supabase
   SQL editor, or the Supabase CLI: `supabase db push`).
3. Copy the URL + anon + service-role keys into the env vars above.

## 3. Build for Cloudflare Workers (OpenNext adapter)

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

Add a minimal `wrangler.toml` at the repo root:

```toml
name = "moldlane"
compatibility_date = "2025-03-01"
compatibility_flags = ["nodejs_compat"]
main = ".open-next/worker.js"

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

Add scripts to `package.json`:

```jsonc
"cf:build": "opennextjs-cloudflare build",
"cf:deploy": "opennextjs-cloudflare build && wrangler deploy",
"cf:preview": "opennextjs-cloudflare build && wrangler dev"
```

Then connect the Git repo in the Cloudflare dashboard with:

- **Build command:** `npm run cf:build`
- **Deploy command:** `wrangler deploy`
- (or run `npm run cf:deploy` locally with `wrangler login`).

Point `app.moldlane.com` at the Worker under **Custom domains**.

Reference: <https://opennext.js.org/cloudflare>

---

## 4. Verify

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
