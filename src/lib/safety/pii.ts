/**
 * Sensitive-content detection (PII + risk flags).
 *
 * Pure, dependency-free, synchronous, safe to run on every inbound
 * message in the webhook hot path. It does two jobs:
 *   1. detect(), find PII spans (card numbers, emails, phones, long IDs)
 *      so the UI can flag them and the engine can branch on them.
 *   2. redact(), mask those spans before text is ever sent to an
 *      external LLM, so a customer's card/BVN never leaves the box.
 *
 * This is a trust primitive, not a compliance product: it is intentionally
 * conservative (better to over-flag a card number than leak one) and is the
 * seed of a sellable "privacy guard" skill in the marketplace.
 */

export type PiiKind = "card" | "email" | "phone" | "id_number";

export interface PiiMatch {
  kind: PiiKind;
  value: string;
  index: number;
}

export interface DetectResult {
  matches: PiiMatch[];
  /** True if anything sensitive was found. */
  hasPii: boolean;
  /** Distinct kinds found, for quick branching / tagging. */
  kinds: PiiKind[];
}

// Email, deliberately simple; we only need to spot one, not validate RFC.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// A run of 13–19 digits, possibly grouped by spaces/dashes, candidate card.
// Validated with Luhn below so random long numbers don't trip it.
const CARD_CANDIDATE_RE = /\b(?:\d[ -]?){13,19}\b/g;

// Phone: African-friendly. Optional +, country code, 7–14 digits with
// common separators. Kept after card/email extraction to reduce overlap.
const PHONE_RE = /(?:\+?\d{1,4}[ -]?)?(?:\(?\d{2,4}\)?[ -]?){2,5}\d{2,4}/g;

// Long opaque identifiers (BVN, NIN, passport-ish): 9–12 digits standalone.
const ID_RE = /\b\d{9,12}\b/g;

/** Luhn check, distinguishes real card numbers from arbitrary digit runs. */
export function luhnValid(digits: string): boolean {
  const s = digits.replace(/\D/g, "");
  if (s.length < 13 || s.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = s.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function detect(text: string): DetectResult {
  if (!text) return { matches: [], hasPii: false, kinds: [] };

  const matches: PiiMatch[] = [];
  const claimed: Array<[number, number]> = []; // [start,end) spans already taken

  const overlaps = (start: number, end: number) =>
    claimed.some(([s, e]) => start < e && end > s);

  const take = (kind: PiiKind, value: string, index: number) => {
    const end = index + value.length;
    if (overlaps(index, end)) return;
    claimed.push([index, end]);
    matches.push({ kind, value, index });
  };

  // Order matters: cards & emails first (most specific), then phones, then
  // bare IDs, earlier claims block later, looser patterns from re-matching.
  for (const m of text.matchAll(CARD_CANDIDATE_RE)) {
    const val = m[0];
    if (luhnValid(val)) take("card", val, m.index ?? 0);
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    take("email", m[0], m.index ?? 0);
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7) take("phone", m[0], m.index ?? 0);
  }
  for (const m of text.matchAll(ID_RE)) {
    take("id_number", m[0], m.index ?? 0);
  }

  const kinds = Array.from(new Set(matches.map((x) => x.kind)));
  return { matches, hasPii: matches.length > 0, kinds };
}

/**
 * Mask PII in text. Keeps a hint of structure (e.g. last 4 of a card) so a
 * human can still recognise context, but the secret itself is gone. Used to
 * sanitise text before it is sent to an external LLM.
 */
export function redact(text: string): string {
  const { matches } = detect(text);
  if (matches.length === 0) return text;

  // Apply right-to-left so indices stay valid as we splice.
  const ordered = [...matches].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of ordered) {
    out =
      out.slice(0, m.index) +
      maskValue(m) +
      out.slice(m.index + m.value.length);
  }
  return out;
}

function maskValue(m: PiiMatch): string {
  switch (m.kind) {
    case "card": {
      const digits = m.value.replace(/\D/g, "");
      return `[card ••••${digits.slice(-4)}]`;
    }
    case "email": {
      const [, domain] = m.value.split("@");
      return `[email •••@${domain ?? "•••"}]`;
    }
    case "phone":
      return "[phone redacted]";
    case "id_number":
      return "[id redacted]";
    default:
      return "[redacted]";
  }
}
