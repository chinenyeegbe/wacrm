import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare Workers adapter config.
 *
 * The defaults are deliberate: wacrm keeps all state in Supabase
 * (Postgres + Auth + Realtime + Storage), so we do NOT wire any
 * Cloudflare KV / D1 / R2 caching or queue overrides here. The worker
 * is a stateless SSR/runtime shell; every per-user read still goes to
 * Supabase with the request's auth context, exactly as on Node hosts.
 *
 * If you later want incremental-cache or tag revalidation backed by
 * Cloudflare, pass `incrementalCache` / `tagCache` overrides — see
 * https://opennext.js.org/cloudflare/caching. Until then, leave this
 * empty so behaviour matches the current Hostinger/Node deploy.
 */
export default defineCloudflareConfig();
