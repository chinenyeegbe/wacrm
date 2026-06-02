/**
 * Amount parsing for payment requests.
 *
 * Merchants and AI steps type amounts as humans do, "3,500", "₦15,000",
 * "15000.50". We normalise to integer MINOR units (kobo/cents) so all
 * downstream math is float-free.
 */

/**
 * Parse a human-typed amount into minor units. Strips currency symbols,
 * spaces, and thousands separators; keeps the decimal point. Returns null
 * for anything that isn't a positive number.
 */
export function parseAmountToMinor(raw: string | number): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw * 100);
  }
  if (typeof raw !== "string") return null;

  // Reject explicit negatives up front, stripping the sign below would
  // otherwise turn "-100" into a positive 100.
  if (/-\s*\d/.test(raw)) return null;

  // Remove everything except digits and separators, then drop grouping
  // commas/spaces, leaving an optional single decimal point.
  const cleaned = raw
    .replace(/[^\d.,\s]/g, "")
    .replace(/[\s,](?=\d{3}\b)/g, "") // thousands separators
    .replace(/,/g, ".") // any remaining comma is a decimal (e.g. "15,50")
    .trim();

  if (!cleaned) return null;

  // If multiple dots survived (e.g. "1.234.56"), keep the last as decimal.
  const parts = cleaned.split(".");
  const normalised =
    parts.length > 2
      ? parts.slice(0, -1).join("") + "." + parts[parts.length - 1]
      : cleaned;

  const value = Number(normalised);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** A unique, URL-safe payment reference. Prefixed so it's greppable in logs. */
export function generateReference(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `wacrm_${Date.now().toString(36)}_${rand}`;
}
