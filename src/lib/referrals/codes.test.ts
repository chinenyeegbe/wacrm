import { describe, it, expect } from "vitest";
import {
  generatePartnerCode,
  normalizeCode,
  formatCode,
  codesMatch,
  extractRefFromUrl,
  buildReferralUrl,
} from "./codes";

describe("generatePartnerCode", () => {
  it("uses a name-derived prefix and a hyphen", () => {
    const code = generatePartnerCode("Ada Lovelace");
    expect(code.startsWith("ADA")).toBe(true);
    expect(code).toContain("-");
  });

  it("falls back to a random prefix for nameless seeds", () => {
    const code = generatePartnerCode("123 !!!");
    expect(code).toMatch(/^[2-9A-Z]+-[2-9A-Z]+$/);
  });

  it("is unique across many generations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generatePartnerCode("Ada"));
    // Collisions should be vanishingly rare; allow a tiny margin.
    expect(seen.size).toBeGreaterThan(495);
  });
});

describe("normalizeCode", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeCode("ada-7k3q")).toBe("ADA7K3Q");
    expect(normalizeCode("ADA 7K3Q")).toBe("ADA7K3Q");
  });
  it("returns empty for junk", () => {
    expect(normalizeCode("!!!")).toBe("");
    expect(normalizeCode(undefined as unknown as string)).toBe("");
  });
});

describe("formatCode", () => {
  it("inserts a hyphen before the last 4 chars", () => {
    expect(formatCode("ADA7K3Q")).toBe("ADA-7K3Q");
    expect(formatCode("ada 7k3q")).toBe("ADA-7K3Q");
  });
  it("leaves short codes untouched", () => {
    expect(formatCode("7K3Q")).toBe("7K3Q");
  });
});

describe("codesMatch", () => {
  it("matches regardless of formatting", () => {
    expect(codesMatch("ADA-7K3Q", "ada7k3q")).toBe(true);
    expect(codesMatch("ADA-7K3Q", "ADA 7K3Q")).toBe(true);
  });
  it("does not match different codes or empties", () => {
    expect(codesMatch("ADA-7K3Q", "BEN-9X2P")).toBe(false);
    expect(codesMatch("", "")).toBe(false);
  });
});

describe("extractRefFromUrl", () => {
  it("reads ?ref= and ?r=", () => {
    expect(extractRefFromUrl("https://x.com/signup?ref=ADA-7K3Q")).toBe(
      "ADA7K3Q",
    );
    expect(extractRefFromUrl("https://x.com/signup?r=ben9x2p")).toBe("BEN9X2P");
  });
  it("returns null when absent or empty", () => {
    expect(extractRefFromUrl("https://x.com/signup")).toBeNull();
    expect(extractRefFromUrl("https://x.com/signup?ref=")).toBeNull();
    expect(extractRefFromUrl("not a url")).toBeNull();
  });
});

describe("buildReferralUrl", () => {
  it("builds a normalised signup link", () => {
    expect(buildReferralUrl("https://wacrm.tech", "ada-7k3q")).toBe(
      "https://wacrm.tech/signup?ref=ADA7K3Q",
    );
  });
  it("trims trailing slashes on the base", () => {
    expect(buildReferralUrl("https://wacrm.tech/", "ADA7K3Q")).toBe(
      "https://wacrm.tech/signup?ref=ADA7K3Q",
    );
  });
});
