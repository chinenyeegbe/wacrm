import { describe, it, expect } from "vitest";
import { detect, redact, luhnValid } from "./pii";

describe("luhnValid", () => {
  it("accepts a valid test card", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
  });
  it("rejects a random long number", () => {
    expect(luhnValid("1234567890123456")).toBe(false);
  });
});

describe("detect", () => {
  it("flags a valid card number", () => {
    const r = detect("my card is 4242 4242 4242 4242 please charge it");
    expect(r.hasPii).toBe(true);
    expect(r.kinds).toContain("card");
  });

  it("flags an email", () => {
    const r = detect("reach me at ada@example.com");
    expect(r.kinds).toContain("email");
  });

  it("flags a phone number", () => {
    const r = detect("call +234 803 123 4567");
    expect(r.kinds).toContain("phone");
  });

  it("returns clean for ordinary text", () => {
    const r = detect("how much for two gowns?");
    expect(r.hasPii).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it("does not double-claim overlapping spans", () => {
    // A card-shaped run should be claimed as a card, not re-matched as a phone/id.
    const r = detect("4242424242424242");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].kind).toBe("card");
  });
});

describe("redact", () => {
  it("masks a card but keeps the last 4", () => {
    const out = redact("pay with 4242 4242 4242 4242");
    expect(out).toContain("••••4242");
    expect(out).not.toContain("4242 4242 4242 4242");
  });

  it("masks an email but keeps the domain", () => {
    const out = redact("email ada@shop.com");
    expect(out).toContain("@shop.com");
    expect(out).not.toContain("ada@shop.com");
  });

  it("leaves clean text untouched", () => {
    const text = "two gowns and a headtie";
    expect(redact(text)).toBe(text);
  });
});
