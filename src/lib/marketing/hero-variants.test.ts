import { describe, it, expect } from "vitest";
import { pickVariants, BUSINESS_HERO, AGENT_HERO } from "./hero-variants";

describe("pickVariants", () => {
  it("picks the region set from a full locale", () => {
    expect(pickVariants(BUSINESS_HERO, "en-NG")).toBe(BUSINESS_HERO.NG);
    expect(pickVariants(BUSINESS_HERO, "en-ZA")).toBe(BUSINESS_HERO.ZA);
  });

  it("is case-insensitive on the region subtag", () => {
    expect(pickVariants(BUSINESS_HERO, "en-ng")).toBe(BUSINESS_HERO.NG);
  });

  it("reads the last subtag for script-tagged locales", () => {
    expect(pickVariants(BUSINESS_HERO, "en-Latn-ZA")).toBe(BUSINESS_HERO.ZA);
  });

  it("falls back to default for unknown or bare locales", () => {
    expect(pickVariants(BUSINESS_HERO, "en")).toBe(BUSINESS_HERO.default);
    expect(pickVariants(BUSINESS_HERO, "en-US")).toBe(BUSINESS_HERO.default);
    expect(pickVariants(BUSINESS_HERO, undefined)).toBe(BUSINESS_HERO.default);
    expect(pickVariants(BUSINESS_HERO, null)).toBe(BUSINESS_HERO.default);
    expect(pickVariants(BUSINESS_HERO, "")).toBe(BUSINESS_HERO.default);
  });

  it("every region set is non-empty for both heroes", () => {
    for (const sets of [BUSINESS_HERO, AGENT_HERO]) {
      for (const region of Object.keys(sets) as (keyof typeof sets)[]) {
        expect(sets[region].length).toBeGreaterThan(0);
      }
    }
  });
});
