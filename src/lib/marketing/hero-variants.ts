/**
 * Hero phrase variants for the rotating headline animation.
 *
 * The hero leads with a fixed line and rotates a short, concrete benefit
 * phrase through it ("sell more", "reply faster", "bring customers back").
 * Many small, plain promises beat one generic claim, and a visitor reads
 * the one that matches where they are.
 *
 * Localisation: the same words do not land the same way in Lagos, Accra,
 * Nairobi, and Johannesburg. So phrases are keyed by region and the client
 * picks a set from the visitor's locale (navigator.language). The content
 * here is intentionally plain and conservative; it is a structure to be
 * tuned with real local input per market, not a finished translation.
 *
 * Pure data + a pure picker, so it is trivially testable.
 */

export type Region = "default" | "NG" | "GH" | "KE" | "ZA";

export type HeroVariants = Record<Region, string[]>;

// Business hero: lead is "WhatsApp that helps you ___".
// Keep each phrase short, lowercase, and benefit-first.
export const BUSINESS_HERO: HeroVariants = {
  default: [
    "sell more",
    "reply faster",
    "bring back old customers",
    "never miss a buyer",
    "get repeat orders",
    "answer day and night",
    "close more sales",
    "keep customers coming back",
  ],
  NG: [
    "make more sales",
    "reply sharp sharp",
    "bring back old customers",
    "never miss a buyer",
    "get repeat orders",
    "answer day and night",
    "close more deals",
    "keep customers coming back",
  ],
  GH: [
    "sell more",
    "reply faster",
    "bring back old customers",
    "never miss a buyer",
    "get repeat orders",
    "answer any time",
    "close more sales",
    "keep customers coming back",
  ],
  KE: [
    "sell more",
    "reply faster",
    "bring back old customers",
    "never miss a buyer",
    "get repeat orders",
    "answer day and night",
    "close more sales",
    "keep customers coming back",
  ],
  ZA: [
    "sell more",
    "reply faster",
    "bring back old customers",
    "never miss a buyer",
    "get repeat orders",
    "answer any time",
    "close more sales",
    "keep customers coming back",
  ],
};

// Agent hero: lead is "Help a shop ___ and earn".
export const AGENT_HERO: HeroVariants = {
  default: [
    "sell more",
    "reply faster",
    "get repeat buyers",
    "bring customers back",
    "never miss a sale",
    "grow",
  ],
  NG: [
    "make more sales",
    "reply sharp sharp",
    "get repeat buyers",
    "bring customers back",
    "never miss a sale",
    "grow",
  ],
  GH: [
    "sell more",
    "reply faster",
    "get repeat buyers",
    "bring customers back",
    "never miss a sale",
    "grow",
  ],
  KE: [
    "sell more",
    "reply faster",
    "get repeat buyers",
    "bring customers back",
    "never miss a sale",
    "grow",
  ],
  ZA: [
    "sell more",
    "reply faster",
    "get repeat buyers",
    "bring customers back",
    "never miss a sale",
    "grow",
  ],
};

/**
 * Pick a phrase set from a locale string like "en-NG", "en", or undefined.
 * Reads the region subtag, matches it case-insensitively, and falls back to
 * the default set for anything unknown.
 */
export function pickVariants(sets: HeroVariants, locale?: string | null): string[] {
  if (!locale || typeof locale !== "string") return sets.default;
  // e.g. "en-NG" -> "NG"; "en" -> "" ; "en-Latn-ZA" -> "ZA"
  const parts = locale.split("-");
  const region = parts[parts.length - 1]?.toUpperCase();
  if (region && region.length === 2 && region in sets) {
    return sets[region as Region];
  }
  return sets.default;
}
