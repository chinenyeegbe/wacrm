// OpenNext Cloudflare adapter config.
//
// This is what lets Moldlane (a full Next.js app with API routes, auth, and
// Node `crypto`) run on Cloudflare Workers with the Node.js runtime. Build
// and deploy with the scripts in package.json:
//   npm run cf:preview   # build + run locally on the Workers runtime
//   npm run cf:deploy    # build + deploy to Cloudflare
//
// Defaults are fine for a first deploy. Later you can wire an R2/KV
// incremental cache here for faster cold paths; see the adapter docs.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
