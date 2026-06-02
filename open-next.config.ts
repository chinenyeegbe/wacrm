import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext adapter config — runs this Next.js app (middleware + SSR)
// on Cloudflare Workers. Defaults are fine for our use: no ISR/edge
// cache wiring needed since data lives in Supabase, not Next's cache.
export default defineCloudflareConfig();
