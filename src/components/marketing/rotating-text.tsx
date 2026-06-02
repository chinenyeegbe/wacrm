"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pickVariants, type HeroVariants } from "@/lib/marketing/hero-variants";

/**
 * Rotating headline phrase. Cycles a list of short benefit phrases with a
 * gentle fade-and-rise, so a visitor reads the promise that fits them.
 *
 * Conversion-minded but not fussy:
 *  - SSR-safe: renders the default first phrase on the server and on the
 *    first client paint (no hydration flash), then takes over.
 *  - Localised on the client from navigator.language, so the same component
 *    shows the Lagos phrasing in Lagos and the default elsewhere.
 *  - Respects prefers-reduced-motion: holds a single phrase, no movement.
 *  - Accessible: the animated text is aria-hidden; screen readers get one
 *    stable phrase instead of flicker.
 */
export function RotatingText({
  sets,
  intervalMs = 2200,
  className,
}: {
  sets: HeroVariants;
  intervalMs?: number;
  className?: string;
}) {
  const [variants, setVariants] = useState<string[]>(sets.default);
  const [index, setIndex] = useState(0);
  const lenRef = useRef(variants.length);
  lenRef.current = variants.length;

  useEffect(() => {
    // Localise from the browser, if it points at a region we tuned.
    const locale =
      typeof navigator !== "undefined" ? navigator.language : undefined;
    const picked = pickVariants(sets, locale);
    if (picked !== variants) {
      setVariants(picked);
      setIndex(0);
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % (lenRef.current || 1));
    }, intervalMs);
    return () => clearInterval(id);
    // sets/intervalMs are stable props; variants intentionally excluded so
    // the interval is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, intervalMs]);

  const phrase = variants[index] ?? variants[0] ?? "";

  return (
    <span className={cn("inline-block", className)}>
      <span
        key={index}
        aria-hidden="true"
        className="inline-block animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
      >
        {phrase}
      </span>
      {/* Stable phrase for screen readers (no flicker). */}
      <span className="sr-only">{sets.default[0]}</span>
    </span>
  );
}
