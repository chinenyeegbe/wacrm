/**
 * Per-key fixed-window rate limiter with a pluggable backend.
 *
 * Fixed-window counter (not token bucket): every identifier gets a
 * fresh N-request budget each window.
 *
 * Two backends, chosen automatically at call time:
 *
 *  1. **Cloudflare KV** — used when a `RATE_LIMIT_KV` binding is present
 *     on the Worker. The counter lives in KV, so it is shared across
 *     every Worker isolate / region and the limit actually holds under
 *     horizontal scale. Best-effort: KV has no atomic increment, so
 *     two truly-simultaneous requests can both read the same count and
 *     under-count by one — acceptable for coarse per-user API limits,
 *     and the failure mode is permissive, not a lockout. Any KV error
 *     falls back to memory so a limiter hiccup never takes down the
 *     endpoint it protects.
 *
 *  2. **In-memory Map** — the default when no KV binding is configured
 *     (local dev, tests, single-node self-host). A single process holds
 *     the Map, so with more than one instance the limit is per-instance
 *     only. Allocation-light; expired keys are swept opportunistically
 *     (see LIGHT_SWEEP) with no background timer.
 *
 * Call sites `await checkRateLimit(...)` and get the same
 * `RateLimitResult` shape regardless of backend.
 */

import { NextResponse } from 'next/server';

/** Name of the optional Cloudflare KV binding for shared rate-limit
 *  state. Provision it in `wrangler.jsonc` to enable cross-isolate
 *  limiting (see CLOUDFLARE_DEPLOY.md). */
const KV_BINDING_NAME = 'RATE_LIMIT_KV';

/** Minimal structural view of a Cloudflare KV namespace — just the two
 *  methods we use. Avoids a hard dependency on `@cloudflare/workers-
 *  types` for a single optional code path. */
interface KVLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

// Cloudflare KV enforces a 60s minimum on `expirationTtl`.
const KV_MIN_TTL_SECONDS = 60;

export interface RateLimitOptions {
  /** Max requests allowed in `windowMs`. */
  limit: number;
  /** Window size, milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Unix ms when the bucket refills. */
  reset: number;
  limit: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

// Opportunistic cleanup. Running a sweep on every call would be
// quadratic; running it 1-in-N lets the Map self-drain without a
// background timer.
const LIGHT_SWEEP_EVERY = 1000;
let callsSinceSweep = 0;

function sweepExpired(now: number) {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

function checkRateLimitInMemory(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= LIGHT_SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs, limit };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt, limit };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: limit - entry.count,
    reset: entry.resetAt,
    limit,
  };
}

// Resolve the KV binding once per isolate. `null` means "no binding
// configured" (dev / test / self-host) — we don't retry, since the
// binding set is fixed for the life of the isolate.
let kvResolved = false;
let kvBinding: KVLike | null = null;

function isKVLike(v: unknown): v is KVLike {
  return (
    !!v &&
    typeof (v as KVLike).get === 'function' &&
    typeof (v as KVLike).put === 'function'
  );
}

async function getKvBinding(): Promise<KVLike | null> {
  if (kvResolved) return kvBinding;
  kvResolved = true;
  try {
    // Dynamic import so the Cloudflare adapter is only pulled in at
    // request time on the Worker — never during tests or the build's
    // module graph analysis.
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as Record<string, unknown>)[KV_BINDING_NAME];
    kvBinding = isKVLike(binding) ? binding : null;
  } catch {
    // No Cloudflare context (local dev / tests / non-Workers host).
    kvBinding = null;
  }
  return kvBinding;
}

function safeParseEntry(raw: string | null): Entry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Entry>;
    if (typeof parsed.count === 'number' && typeof parsed.resetAt === 'number') {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {
    // Corrupt value — treat as absent so the window simply reopens.
  }
  return null;
}

async function checkRateLimitViaKv(
  kv: KVLike,
  key: string,
  { limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = safeParseEntry(await kv.get(key));

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    // TTL clamped to KV's 60s floor; the `resetAt <= now` check above
    // enforces the real logical window regardless of physical TTL.
    const ttl = Math.max(KV_MIN_TTL_SECONDS, Math.ceil(windowMs / 1000));
    await kv.put(key, JSON.stringify({ count: 1, resetAt }), {
      expirationTtl: ttl,
    });
    return { success: true, remaining: limit - 1, reset: resetAt, limit };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt, limit };
  }

  const count = entry.count + 1;
  const ttl = Math.max(
    KV_MIN_TTL_SECONDS,
    Math.ceil((entry.resetAt - now) / 1000),
  );
  await kv.put(key, JSON.stringify({ count, resetAt: entry.resetAt }), {
    expirationTtl: ttl,
  });
  return {
    success: true,
    remaining: limit - count,
    reset: entry.resetAt,
    limit,
  };
}

/**
 * Consume one unit against `key`'s budget. Uses Cloudflare KV when the
 * `RATE_LIMIT_KV` binding is configured (shared across isolates),
 * otherwise an in-process Map. A KV failure degrades to the in-memory
 * limiter rather than erroring.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const kv = await getKvBinding();
  if (kv) {
    try {
      return await checkRateLimitViaKv(kv, key, opts);
    } catch {
      // Fall through to the in-memory limiter on any KV error.
    }
  }
  return checkRateLimitInMemory(key, opts);
}

/**
 * Standard 429 response with the headers clients expect (RFC 6585 +
 * draft-ietf-httpapi-ratelimit-headers). Callers just `return` this.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retry_after_seconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
      },
    },
  );
}

/** Preconfigured budgets, tweak here not at call sites. */
export const RATE_LIMITS = {
  /** Individual message send. 60/min per user = one per second
   *  sustained, comfortable for a live human typing. */
  send: { limit: 60, windowMs: 60_000 },
  /** Broadcast dispatch. 5/min per user — even a 1 000-recipient
   *  broadcast is one call; this caps the rate at which a single user
   *  can launch campaigns, not the messages inside one. */
  broadcast: { limit: 5, windowMs: 60_000 },
  /** Reaction add/swap/remove. More permissive than send — users
   *  fidget with reactions and a single "swap" is actually two calls
   *  (remove + add) under the hood. */
  react: { limit: 120, windowMs: 60_000 },
} as const;

/** Test-only helper. Clears the in-memory state so unit tests don't
 *  leak buckets across files. Not wired up in production code. */
export function __resetRateLimitForTests() {
  buckets.clear();
  callsSinceSweep = 0;
}
