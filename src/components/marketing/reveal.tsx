"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal wrapper. Fades and lifts its content into view the first
 * time it scrolls on screen. Slick but not fussy: it plays once, never
 * blocks reading, and the styling lives in globals.css so the "from" state
 * only exists when JS is on (no flash, no-JS/SEO safe).
 *
 * The component just toggles data-shown when the element intersects; CSS
 * does the rest. Reduced-motion users are handled in CSS too.
 */
export function Reveal({
  children,
  className,
  /** Stagger sibling reveals by passing increasing delays (ms). */
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      el.setAttribute("data-shown", "true");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          el.setAttribute("data-shown", "true");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={className}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
