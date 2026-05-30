/**
 * Referral codes — the identity of a "partner" (reseller / operator /
 * affiliate) in the growth network.
 *
 * A partner is any user who refers a business to the platform. They get a
 * short, human-shareable code (e.g. "ADA-7K3Q") that goes on links, flyers,
 * WhatsApp status, and word-of-mouth. When a business signs up with that
 * code, the partner earns a share of the platform's commission on that
 * business — forever (or for a configured window). That recurring,
 * outcome-linked payout is what makes neighbourhood selling worth it.
 *
 * Pure & dependency-free so it runs identically on server and client and is
 * trivially testable.
 */

// Crockford-ish alphabet: no 0/O, 1/I/L, U — removes the characters people
// misread or that form unwanted words. 30 symbols.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_BODY_LEN = 4; // e.g. "7K3Q" → 30^4 ≈ 810k per prefix

/**
 * Build a partner code from a display name (or any seed). The prefix is a
 * cleaned, ≤4-char slug of the name so the code feels personal ("ADA-…"),
 * and the body is random for uniqueness. Falls back to a fully random
 * prefix when the seed has no usable letters.
 */
export function generatePartnerCode(seed?: string): string {
  const prefix = slugPrefix(seed);
  return `${prefix}-${randomBody()}`;
}

function slugPrefix(seed?: string): string {
  const cleaned = (seed ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[OILU]/g, ""); // keep prefix within the safe-ish alphabet
  if (cleaned.length >= 2) return cleaned.slice(0, 4);
  return randomBody(); // no usable name → random prefix
}

function randomBody(): string {
  let out = "";
  const bytes = randomBytes(CODE_BODY_LEN);
  for (let i = 0; i < CODE_BODY_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/**
 * Normalise a code for storage/comparison: uppercase, strip everything
 * that isn't an alphabet character. So "ada-7k3q", "ADA 7K3Q" and
 * "ADA7K3Q" all compare equal. Returns "" for input with no usable chars.
 */
export function normalizeCode(input: string): string {
  if (typeof input !== "string") return "";
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Display form: PREFIX-BODY, inserting the hyphen before the last 4 chars. */
export function formatCode(raw: string): string {
  const n = normalizeCode(raw);
  if (n.length <= CODE_BODY_LEN) return n;
  const split = n.length - CODE_BODY_LEN;
  return `${n.slice(0, split)}-${n.slice(split)}`;
}

/** True when two codes refer to the same partner, ignoring formatting. */
export function codesMatch(a: string, b: string): boolean {
  const na = normalizeCode(a);
  return na.length > 0 && na === normalizeCode(b);
}

/**
 * Pull a referral code from a URL's `?ref=` (or `?r=`) query param.
 * Returns the normalised code, or null if absent/empty.
 */
export function extractRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const raw = u.searchParams.get("ref") ?? u.searchParams.get("r");
    if (!raw) return null;
    const n = normalizeCode(raw);
    return n.length > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Build a shareable signup link carrying the partner's code. This is the
 * viral primitive — it can be dropped on a WhatsApp status, a flyer QR, or
 * appended to outbound business messages as a "powered by" tag.
 */
export function buildReferralUrl(baseUrl: string, code: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/signup?ref=${encodeURIComponent(normalizeCode(code))}`;
}
