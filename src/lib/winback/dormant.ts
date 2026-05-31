/**
 * Win-back: find the customers a business has not heard from in a while.
 *
 * Most micro-businesses do zero marketing, they just wait to be remembered.
 * The cheapest revenue they have is a past customer nudged to come back.
 * This module is the pure, tested brain that decides who counts as "quiet".
 *
 * IMPORTANT (compliance): re-engaging a customer who last messaged more than
 * 24 hours ago is OUTSIDE WhatsApp's customer-care window, so the actual
 * message must go out as a Meta-approved template (the broadcast flow), not
 * free text. This module only selects WHO to reach; the send path enforces
 * the template rule.
 *
 * Pure and dependency-free: operates on plain rows, no DB, no clock except
 * the `now` you pass, so it is trivially testable.
 */

const MS_PER_DAY = 86_400_000;

export interface DormantCandidate {
  id: string;
  /** ISO timestamp of the last activity on the conversation, or null. */
  last_message_at?: string | null;
  /** Conversation status; closed/old ones are still valid win-back targets. */
  status?: string | null;
}

export interface DormantResult<T> {
  item: T;
  /** Whole days since the last message. */
  daysQuiet: number;
}

export interface SelectDormantOptions {
  /** A customer is "quiet" after this many days of no activity. */
  days: number;
  /** Current time in ms. Defaults to Date.now(); injectable for tests. */
  now?: number;
}

/** Whole days between `lastMessageAt` and `now`. null/invalid → null. */
export function daysSince(
  lastMessageAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!lastMessageAt) return null;
  const t = Date.parse(lastMessageAt);
  if (Number.isNaN(t)) return null;
  const diff = now - t;
  if (diff < 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Select the dormant candidates: those whose last activity is at least
 * `days` ago. Rows with no `last_message_at` are skipped (we have never
 * actually talked to them, so there is nothing to re-warm). Returned newest-
 * quiet last, i.e. the longest-quiet customers first, so a capped campaign
 * reaches the most-at-risk relationships first.
 */
export function selectDormant<T extends DormantCandidate>(
  items: T[],
  { days, now = Date.now() }: SelectDormantOptions,
): DormantResult<T>[] {
  const threshold = Math.max(0, Math.floor(days));
  const out: DormantResult<T>[] = [];
  for (const item of items) {
    const d = daysSince(item.last_message_at, now);
    if (d === null) continue;
    if (d >= threshold) out.push({ item, daysQuiet: d });
  }
  // Longest-quiet first.
  out.sort((a, b) => b.daysQuiet - a.daysQuiet);
  return out;
}

/** Standard windows offered in the UI. */
export const WINBACK_WINDOWS = [30, 60, 90] as const;
export type WinbackWindow = (typeof WINBACK_WINDOWS)[number];

export function isWinbackWindow(v: unknown): v is WinbackWindow {
  return typeof v === "number" && (WINBACK_WINDOWS as readonly number[]).includes(v);
}
