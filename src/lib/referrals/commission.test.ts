import { describe, it, expect } from "vitest";
import {
  splitCommission,
  sumPartnerEarnings,
  shareForCount,
  DEFAULT_PARTNER_TIERS,
} from "./commission";

describe("splitCommission", () => {
  it("gives the partner their share of the platform fee", () => {
    // Gross 10,000.00; platform fee 200.00 (2%); partner keeps 30% of fee.
    const r = splitCommission({
      grossMinor: 1_000_000,
      platformFeeMinor: 20_000,
      partnerShareBps: 3000,
    });
    expect(r.partnerMinor).toBe(6_000); // 30% of 20,000
    expect(r.platformNetMinor).toBe(14_000); // platform keeps the rest
  });

  it("never loses a minor unit (platform absorbs rounding)", () => {
    // 33.33% of an odd fee — partner rounds down, platform keeps remainder.
    const r = splitCommission({
      grossMinor: 99_999,
      platformFeeMinor: 9_999,
      partnerShareBps: 3333,
    });
    expect(r.partnerMinor + r.platformNetMinor).toBe(9_999);
    expect(r.partnerMinor).toBeLessThanOrEqual(r.platformFeeMinor);
    expect(Number.isInteger(r.partnerMinor)).toBe(true);
  });

  it("pays nothing when there is no partner share", () => {
    const r = splitCommission({
      grossMinor: 1_000_000,
      platformFeeMinor: 20_000,
      partnerShareBps: 0,
    });
    expect(r.partnerMinor).toBe(0);
    expect(r.platformNetMinor).toBe(20_000);
  });

  it("clamps shares above 100% and below 0%", () => {
    const over = splitCommission({
      grossMinor: 100,
      platformFeeMinor: 100,
      partnerShareBps: 99_999,
    });
    expect(over.partnerMinor).toBe(100); // capped at the whole fee
    const under = splitCommission({
      grossMinor: 100,
      platformFeeMinor: 100,
      partnerShareBps: -50,
    });
    expect(under.partnerMinor).toBe(0);
  });

  it("handles a zero fee safely", () => {
    const r = splitCommission({
      grossMinor: 1_000_000,
      platformFeeMinor: 0,
      partnerShareBps: 5000,
    });
    expect(r.partnerMinor).toBe(0);
    expect(r.platformNetMinor).toBe(0);
  });
});

describe("sumPartnerEarnings", () => {
  it("totals partner minor across splits", () => {
    const splits = [
      splitCommission({ grossMinor: 0, platformFeeMinor: 10_000, partnerShareBps: 3000 }),
      splitCommission({ grossMinor: 0, platformFeeMinor: 5_000, partnerShareBps: 3000 }),
    ];
    expect(sumPartnerEarnings(splits)).toBe(3_000 + 1_500);
  });
});

describe("shareForCount tiers", () => {
  it("climbs the default ladder as referrals grow", () => {
    expect(shareForCount(0)).toBe(2000);
    expect(shareForCount(4)).toBe(2000);
    expect(shareForCount(5)).toBe(3000);
    expect(shareForCount(19)).toBe(3000);
    expect(shareForCount(20)).toBe(4000);
    expect(shareForCount(50)).toBe(5000);
    expect(shareForCount(1000)).toBe(5000);
  });

  it("default ladder is monotonic and within bounds", () => {
    let prev = -1;
    for (const t of DEFAULT_PARTNER_TIERS) {
      expect(t.shareBps).toBeGreaterThan(prev);
      expect(t.shareBps).toBeLessThanOrEqual(10000);
      prev = t.shareBps;
    }
  });
});
