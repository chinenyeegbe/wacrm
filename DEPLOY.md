# Deploy Moldlane (get a live URL to test on your phone)

This is the honest, shortest path from this repo to a working link.

## Why not GitHub Pages

GitHub Pages only serves **static files**. Moldlane is a full app with API
routes (the WhatsApp webhook, the AI endpoint, payments), login/auth, and
server rendering, so it needs a host that runs a server. Pages would only
ever show a hollow shell. Two good hosts that run the whole thing:
**Vercel** (zero config) and **Cloudflare** (a little more setup). Both
build in the cloud, so your own laptop never has to.

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

## Hosting on Cloudflare (instead of Vercel)

Yes, Cloudflare can host the whole app, with one important choice of adapter:

- **Use `@opennextjs/cloudflare`** (the OpenNext Cloudflare adapter). It runs
  Next.js on Cloudflare Workers with the **Node.js runtime**, which Moldlane
  needs: our token/payment encryption and webhook signature checks use
  Node's `crypto` (AES-256-GCM, HMAC).
- **Do not use `@cloudflare/next-on-pages`** for this app. It forces the
  **edge** runtime on every server route, which does not provide Node
  `crypto`, so the encryption and webhook routes would break.

Steps (run locally once or in a CI runner, not on a weak laptop):

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build      # builds a Workers bundle
npx opennextjs-cloudflare deploy     # deploys (or `preview` to test)
```

Add a minimal `wrangler.toml` (the adapter's docs give the current shape;
it sets the Worker name, `compatibility_date`, and `nodejs_compat`), and put
the same environment variables from the section above into **Cloudflare →
Workers & Pages → your project → Settings → Variables** (mark secrets as
encrypted). For the simplest path, connect the GitHub repo in the Cloudflare
dashboard and let it build on push, the same way Vercel does.

Honest note: this adds an adapter and a config file Vercel does not need, and
I have not been able to run the Cloudflare build from here. If you want, I can
scaffold the `wrangler.toml` + the build scripts and you run one deploy to
confirm. If you just want the fastest live URL, Vercel is the shortest path;
Cloudflare is great once you want its network / pricing.

## If `npm install` crashes your machine

A laptop **restart** during `npm install` (or `npm run dev`) almost always
means it ran out of memory or overheated, not a bug in the project. You have
options, easiest first:

1. **Don't install locally at all.** Deploy to Vercel or Cloudflare (above),
   which build in the cloud. You get a live URL to test on your phone without
   your laptop doing the heavy lifting. This is the recommended path for a
   low-spec machine.
2. **Use a cloud dev environment.** Open the repo in **GitHub Codespaces**
   (github.com → your repo → Code → Codespaces → Create) or Gitpod. It runs
   the install and `npm run dev` on their servers; you just see it in the
   browser. Zero load on your laptop.
3. **If you must run locally,** make the install lighter and avoid running
   other heavy apps at the same time:
   ```bash
   npm install --no-audit --no-fund --prefer-offline
   ```
   The heaviest step is usually `npm run dev` (the Turbopack dev server), not
   the install. Run it alone, and prefer `npm run build` once over keeping
   dev running for long sessions. Adding swap space to your OS also helps.

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
