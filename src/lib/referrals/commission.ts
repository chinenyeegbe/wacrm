/**
 * Commission splitting for the partner / reseller network.
 *
 * When a business pays through a wacrm payment link, the platform takes a
 * fee (payment_config.platform_fee_bps). If that business was referred by a
 * partner, the partner earns a SHARE of that platform fee, recurring, for
 * the life of the referral (or a configured window). This module is the
 * pure math that turns "a payment happened" into "who is owed what".
 *
 * All amounts are integer MINOR units (kobo/cents). All splits are integer
 * basis points (10000 = 100%). No floats, money never rounds by accident.
 *
 * The split is taken out of the PLATFORM's fee, not added on top, so the
 * business pays exactly the same whether or not a partner is involved. The
 * network is funded from our margin, aligned, not extractive.
 */

export interface SplitInput {
  /** Gross amount the customer paid, minor units. */
  grossMinor: number;
  /** Platform fee on that gross, minor units (already computed upstream). */
  platformFeeMinor: number;
  /**
   * Partner's share of the PLATFORM FEE, in basis points. e.g. 3000 = the
   * partner keeps 30% of our fee; we keep 70%. 0 = no partner / no share.
   */
  partnerShareBps: number;
}

export interface SplitResult {
  /** What the partner earns, minor units. */
  partnerMinor: number;
  /** What the platform nets after the partner's share, minor units. */
  platformNetMinor: number;
  /** Echoed for convenience / ledger writes. */
  grossMinor: number;
  platformFeeMinor: number;
}

/**
 * Split a platform fee between partner and platform.
 *
 * Invariants (all asserted by tests):
 *   - partnerMinor + platformNetMinor === platformFeeMinor (never loses a
 *     unit, platform absorbs any rounding remainder).
 *   - 0 ≤ partnerMinor ≤ platformFeeMinor.
 *   - partnerShareBps is clamped to [0, 10000].
 */
export function splitCommission(input: SplitInput): SplitResult {
  const { grossMinor, platformFeeMinor } = input;
  const bps = clampBps(input.partnerShareBps);

  const safeFee = Math.max(0, Math.trunc(platformFeeMinor));

  // Round the partner share DOWN so the platform never pays out more than
  // it earned; the platform keeps the remainder.
  const partnerMinor = Math.floor((safeFee * bps) / 10000);
  const platformNetMinor = safeFee - partnerMinor;

  return {
    partnerMinor,
    platformNetMinor,
    grossMinor: Math.max(0, Math.trunc(grossMinor)),
    platformFeeMinor: safeFee,
  };
}

function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(10000, Math.max(0, Math.trunc(bps)));
}

/**
 * Aggregate many splits into a partner payout total. Used to roll a
 * partner's pending earnings into a single payable figure.
 */
export function sumPartnerEarnings(splits: SplitResult[]): number {
  return splits.reduce((acc, s) => acc + s.partnerMinor, 0);
}

/**
 * Tiered partner share: more referred businesses (or more GMV) → a bigger
 * cut, which is what makes the network self-reinforcing (top sellers are
 * rewarded for recruiting more). Returns basis points.
 *
 * Default ladder is intentionally generous at the top to motivate the
 * "super-connector" who signs up a whole market.
 */
export interface Tier {
  /** Inclusive lower bound on the metric (e.g. active referred businesses). */
  min: number;
  /** Partner share of the platform fee, basis points. */
  shareBps: number;
}

export const DEFAULT_PARTNER_TIERS: Tier[] = [
  { min: 0, shareBps: 2000 }, // 0–4 businesses: 20% of our fee
  { min: 5, shareBps: 3000 }, // 5–19:           30%
  { min: 20, shareBps: 4000 }, // 20–49:          40%
  { min: 50, shareBps: 5000 }, // 50+:            50%
];

/** Resolve the partner's share for a given count against a tier ladder. */
export function shareForCount(
  count: number,
  tiers: Tier[] = DEFAULT_PARTNER_TIERS,
): number {
  let share = 0;
  for (const t of tiers) {
    if (count >= t.min) share = t.shareBps;
  }
  return share;
}
