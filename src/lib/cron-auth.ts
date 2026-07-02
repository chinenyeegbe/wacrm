import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * Shared authentication for the internal cron endpoints
 * (`/api/automations/cron`, `/api/flows/cron`). Both are hit on a
 * schedule by an external pinger (GitHub Actions workflow / Cloudflare
 * Cron / external cron) and gated by a shared secret supplied in the
 * `x-cron-secret` header, matched against `AUTOMATION_CRON_SECRET`.
 */

/**
 * Constant-time string comparison. Returns false (rather than throwing)
 * on a length mismatch — the only thing that leaks, which isn't
 * sensitive — so callers don't have to guard `timingSafeEqual`'s
 * equal-length precondition themselves.
 */
export function cronSecretMatches(supplied: string, expected: string): boolean {
  const suppliedBuf = Buffer.from(supplied)
  const expectedBuf = Buffer.from(expected)
  if (suppliedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(suppliedBuf, expectedBuf)
}

/**
 * Verify a cron request. Returns `null` when authorized, or a
 * `NextResponse` the caller should return as-is: 503 when the secret
 * isn't configured, 401 on mismatch.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret') ?? ''
  if (!cronSecretMatches(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
