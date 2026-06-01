# Deploy Moldlane (get a live URL to test on your phone)

This is the honest, shortest path from this repo to a working link.

## Why not GitHub Pages

GitHub Pages only serves **static files**. Moldlane is a full app with API
routes (the WhatsApp webhook, the AI endpoint, payments), login/auth, and
server rendering, so it needs a host that runs a Node server. Pages would
only ever show a hollow shell. Use **Vercel** (free, built for Next.js).

## The fast path: Vercel

You will need a (free) GitHub account, a Vercel account, and later a
Supabase project. Steps:

1. **Push this repo to your own GitHub** (you already have it at
   `chinenyeegbe/wacrm`).
2. Go to **vercel.com → Add New → Project**, and import the repo.
3. Framework is auto-detected as **Next.js**. Leave the build settings as
   default (`next build`). Click **Deploy**.
4. You get a live URL like `https://moldlane.vercel.app`. Every push gives
   you a fresh preview URL too.

### Want to just SEE the landing pages first?

You can deploy with **no environment variables at all** and the marketing
pages will render:

- `https://your-app.vercel.app/`: the business landing
- `https://your-app.vercel.app/agents`: the agent landing

(The middleware and home page are guarded to skip auth when Supabase is not
configured, so the public pages work standalone. The dashboard, login, AI,
and payments need the setup below.)

## Make the whole app work: Supabase + env vars

1. Create a project at **supabase.com** (free tier is fine). Pick a region
   close to your users.
2. **Run the migrations.** In the Supabase dashboard → SQL Editor, run each
   file in `supabase/migrations/` **in order** (001 up to the latest). They
   are idempotent, so re-running is safe.
3. Get your keys from Supabase → Project Settings → API.
4. In **Vercel → your project → Settings → Environment Variables**, add:

   **Required (the app won't work without these):**
   - `NEXT_PUBLIC_SUPABASE_URL`: your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role key (server only; keep secret)
   - `ENCRYPTION_KEY`: 64 hex chars. Generate with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `META_APP_SECRET`: only needed once you connect WhatsApp (verifies webhooks)

   **Recommended:**
   - `NEXT_PUBLIC_SITE_URL`: your final URL, e.g. `https://moldlane.vercel.app`

   **Turn on the AI (free):**
   - `OPENROUTER_API_KEY`: a free key from <https://openrouter.ai/keys>

   **Turn on payments (per provider, optional for a first look):**
   - configured in-app under Settings → Payments, not as env vars.

5. **Redeploy** (Vercel → Deployments → Redeploy) so the new env vars take
   effect.

See `.env.local.example` for the full annotated list, and `docs/ai.md` /
`docs/payments.md` for those features.

## Run it locally first (optional)

```bash
npm install
cp .env.local.example .env.local   # fill in the values above
npm run dev                          # http://localhost:3000
```

`npm run build` then `npm run start` mirrors the production build.

## After deploy: connect WhatsApp

To actually send and receive messages you connect a Meta WhatsApp Business
number in **Settings → WhatsApp Config**, and point Meta's webhook at
`https://your-app.vercel.app/api/whatsapp/webhook`. Full steps are in the
upstream docs linked from the README. This is the last step; the app,
landing pages, AI, and payments UI all work before you do it.

## A note on custom domains

Once you are happy, add your real domain (e.g. `moldlane.com`) in
Vercel → Settings → Domains, and update `NEXT_PUBLIC_SITE_URL` to match so
links, sitemaps, and referral URLs use it.

## Quick reference: what works at each stage

| Stage | What works |
| --- | --- |
| Vercel, no env | `/` and `/agents` landing pages |
| + Supabase env + migrations | Sign up / log in, dashboard, inbox, contacts, win-back, partner/earn |
| + `OPENROUTER_API_KEY` | AI replies, suggestions, classify, broadcasts copy |
| + Settings → Payments | Payment links, commission, partner earnings |
| + Meta WhatsApp connected | Real inbound/outbound WhatsApp messages |
