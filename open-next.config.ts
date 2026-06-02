import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
	// ISR and 'use cache' payloads stored in R2.
	// Requires the NEXT_INC_CACHE_R2_BUCKET binding in wrangler.jsonc.
	incrementalCache: r2IncrementalCache,
});
