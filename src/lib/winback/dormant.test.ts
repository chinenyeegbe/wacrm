import { describe, it, expect } from "vitest";
import { daysSince, selectDormant, isWinbackWindow } from "./dormant";

const DAY = 86_400_000;
const NOW = Date.parse("2026-06-01T00:00:00Z");
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

describe("daysSince", () => {
  it("counts whole days", () => {
    expect(daysSince(ago(30), NOW)).toBe(30);
    expect(daysSince(ago(0.5), NOW)).toBe(0);
  });
  it("returns null for missing/invalid input", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince("not a date", NOW)).toBeNull();
  });
  it("clamps future timestamps to 0", () => {
    expect(daysSince(ago(-5), NOW)).toBe(0);
  });
});

describe("selectDormant", () => {
  const rows = [
    { id: "fresh", last_message_at: ago(2) },
    { id: "month", last_message_at: ago(31) },
    { id: "quarter", last_message_at: ago(95) },
    { id: "never", last_message_at: null },
  ];

  it("keeps only customers quiet for at least the window", () => {
    const out = selectDormant(rows, { days: 30, now: NOW });
    expect(out.map((r) => r.item.id)).toEqual(["quarter", "month"]);
  });

  it("orders longest-quiet first", () => {
    const out = selectDormant(rows, { days: 30, now: NOW });
    expect(out[0].item.id).toBe("quarter");
    expect(out[0].daysQuiet).toBe(95);
  });

  it("skips customers we have never messaged", () => {
    const out = selectDormant(rows, { days: 1, now: NOW });
    expect(out.find((r) => r.item.id === "never")).toBeUndefined();
  });

  it("a tighter window catches fewer", () => {
    expect(selectDormant(rows, { days: 90, now: NOW })).toHaveLength(1);
    expect(selectDormant(rows, { days: 200, now: NOW })).toHaveLength(0);
  });
});

describe("isWinbackWindow", () => {
  it("accepts the standard windows only", () => {
    expect(isWinbackWindow(30)).toBe(true);
    expect(isWinbackWindow(60)).toBe(true);
    expect(isWinbackWindow(90)).toBe(true);
    expect(isWinbackWindow(45)).toBe(false);
    expect(isWinbackWindow("30")).toBe(false);
  });
});
