import { describe, it, expect } from "vitest";
import { parseAmountToMinor, generateReference } from "./amount";
import { computePlatformFee, formatMinor } from "./providers";

describe("parseAmountToMinor", () => {
  it("parses a plain integer", () => {
    expect(parseAmountToMinor("15000")).toBe(1_500_000);
  });

  it("strips a currency symbol and thousands separators", () => {
    expect(parseAmountToMinor("₦15,000")).toBe(1_500_000);
    expect(parseAmountToMinor("KES 3,500")).toBe(350_000);
  });

  it("keeps a decimal point", () => {
    expect(parseAmountToMinor("15000.50")).toBe(1_500_050);
  });

  it("treats a lone comma as a decimal", () => {
    // "15,50" → 15.50
    expect(parseAmountToMinor("15,50")).toBe(1550);
  });

  it("accepts numbers directly", () => {
    expect(parseAmountToMinor(3500)).toBe(350_000);
  });

  it("rejects junk and non-positive values", () => {
    expect(parseAmountToMinor("free")).toBeNull();
    expect(parseAmountToMinor("0")).toBeNull();
    expect(parseAmountToMinor("-100")).toBeNull();
    expect(parseAmountToMinor("")).toBeNull();
  });
});

describe("computePlatformFee", () => {
  it("returns 0 when the fee is off", () => {
    expect(computePlatformFee(1_500_000, 0)).toBe(0);
  });

  it("computes basis points with integer rounding", () => {
    // 2% of 15,000.00 = 300.00 → 30000 minor
    expect(computePlatformFee(1_500_000, 200)).toBe(30_000);
    // 1.5% of 3,500.00 = 52.50 → 5250 minor
    expect(computePlatformFee(350_000, 150)).toBe(5_250);
  });

  it("never produces a float", () => {
    const fee = computePlatformFee(99_999, 137);
    expect(Number.isInteger(fee)).toBe(true);
  });
});

describe("formatMinor", () => {
  it("formats minor units as currency", () => {
    expect(formatMinor(1_500_000, "NGN")).toContain("15,000");
  });

  it("formats with grouping even for an unusual currency code", () => {
    const out = formatMinor(100_000, "XYZ");
    expect(out).toContain("1,000");
  });
});

describe("generateReference", () => {
  it("is unique and prefixed", () => {
    const a = generateReference();
    const b = generateReference();
    expect(a).not.toBe(b);
    expect(a.startsWith("wacrm_")).toBe(true);
  });
});
