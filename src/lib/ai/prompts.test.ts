import { describe, it, expect } from "vitest";
import { parseClassification } from "./prompts";

describe("parseClassification", () => {
  it("parses a clean JSON object", () => {
    const c = parseClassification(
      '{"intent":"buying","sentiment":"positive","hot_lead":true,"needs_human":false,"summary":"Wants 2 gowns"}',
    );
    expect(c.intent).toBe("buying");
    expect(c.sentiment).toBe("positive");
    expect(c.hot_lead).toBe(true);
    expect(c.needs_human).toBe(false);
    expect(c.summary).toBe("Wants 2 gowns");
  });

  it("extracts JSON wrapped in prose / code fences (free-model habit)", () => {
    const raw =
      'Sure! Here is the classification:\n```json\n{"intent":"complaint","sentiment":"negative","hot_lead":false,"needs_human":true,"summary":"Angry about late delivery"}\n```';
    const c = parseClassification(raw);
    expect(c.intent).toBe("complaint");
    expect(c.needs_human).toBe(true);
  });

  it("falls back to human routing on unparseable output", () => {
    const c = parseClassification("I cannot do that.");
    expect(c.intent).toBe("other");
    expect(c.needs_human).toBe(true); // safe default, escalate
  });

  it("coerces unknown enum values to safe defaults", () => {
    const c = parseClassification(
      '{"intent":"banana","sentiment":"furious","hot_lead":"yes","needs_human":1,"summary":""}',
    );
    expect(c.intent).toBe("other");
    expect(c.sentiment).toBe("neutral");
    // hot_lead only true on strict boolean true
    expect(c.hot_lead).toBe(false);
    // needs_human only true on strict boolean true; 1 is not true → false
    expect(c.needs_human).toBe(false);
    expect(c.summary.length).toBeGreaterThan(0); // fallback summary
  });

  it("clamps an over-long summary", () => {
    const long = "x".repeat(500);
    const c = parseClassification(
      `{"intent":"question","sentiment":"neutral","hot_lead":false,"needs_human":false,"summary":"${long}"}`,
    );
    expect(c.summary.length).toBeLessThanOrEqual(120);
  });
});
