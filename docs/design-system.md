# Moldlane design system

> Simple yet powerful — Notion-calm, but it earns its keep on a cheap
> Android phone on a 3G connection. Mobile-first, always.

## Brand idea

**Moldlane** = the *lane* you *mould* your business into — a guided path
from chaos (a phone full of chats) to a running machine (AI that sells and
collects). The visual language should feel **calm, trustworthy, and
money-adjacent** without shouting.

## Color

The signature is a **deep teal-green** — it reads as money, growth, and
trust, and is deliberately offset from WhatsApp's bright green so we're
*adjacent to* the channel, not pretending to be it.

| Token | Value (oklch) | Use |
| --- | --- | --- |
| `--primary` | `oklch(0.66 0.13 178)` | Buttons, active nav, links, focus rings |
| `--primary-foreground` | `oklch(0.16 0.02 195)` | Text on primary (dark, for contrast on the bright teal) |
| `--background` | `oklch(0.145 0.012 195)` | App base — near-black with a faint teal cast |
| `--card` | `oklch(0.19 0.013 195)` | Cards, popovers |
| `--chart-2` (gold) | `oklch(0.78 0.14 75)` | **Earnings / money highlights** — warm gold against the teal |
| `--destructive` | `oklch(0.577 0.245 27.3)` | Errors, danger |

It's implemented as the **`moldlane` theme** (the default) in
`src/app/globals.css`, alongside 5 alternate themes the user can pick in
Settings → Appearance. All components consume tokens (`bg-primary`,
`text-primary`, `border-primary`), never hard-coded colors, so theming is
one CSS block.

**Accessibility:** primary-on-background and foreground-on-primary both
target WCAG AA (≥4.5:1 for body text). The dark base + bright teal clears
it comfortably; gold is reserved for large/non-essential highlights.

## Typography

- **Inter** (variable, self-hosted via `next/font`) — one family, no
  network round-trip, excellent at small sizes on cheap screens.
- Scale (Tailwind): page title `text-2xl font-bold`; section `text-base
  font-semibold`; body `text-sm`; meta/hints `text-xs`; micro-labels
  `text-[10px] uppercase tracking-wide`.
- **Tabular numerals** for money — amounts should never jitter as they
  change.

## Spacing, radius, motion

- Radius: `--radius: 0.7rem` (slightly softer than the base) → friendly,
  not corporate-sharp.
- Spacing: 4px grid (Tailwind defaults). Generous whitespace = the "calm".
- Motion: short and purposeful (150–200ms). No decorative animation that
  burns battery / CPU on low-end devices. Respect
  `prefers-reduced-motion`.

## Mobile-first rules (non-negotiable — Africa is mobile-first)

Desktop-primary apps fail here. Every screen is designed for a thumb first,
a mouse second.

1. **Bottom tab bar** is the primary navigation on mobile
   (`components/layout/mobile-nav.tsx`): Home, Inbox, Automate, Earn, More.
   The desktop sidebar only appears at `lg+`.
2. **Touch targets ≥ 44px.** Nav rows, buttons, list items.
3. **Safe areas**: `env(safe-area-inset-*)` so the tab bar clears the iOS
   home indicator; `viewportFit: cover`.
4. **Thumb-reachable actions**: primary actions sit at the bottom of
   sheets/forms, not the top.
5. **Single-column by default**; multi-column only at `sm+`/`lg+`.
6. **Performance is a feature**: self-hosted font, no heavy client libs on
   the hot path, lazy-load the canvas/flows editor. Assume a slow network
   and a 3-year-old Android.
7. **Offline-tolerant copy**: every async action has a loading and a clear
   error state (we already use `sonner` toasts + skeletons).
8. **Installable (PWA-ready)**: `applicationName`, apple-web-app meta, and
   theme-color are set so "Add to Home Screen" feels native. (A full
   manifest + service worker is a fast follow.)

## Iconography

`lucide-react` throughout — one consistent stroke-based set. Feature
accents: AI = `Sparkles`/`Filter` (fuchsia tint), Payments = `CreditCard`
(emerald), Earn/partner = `Gift` (primary). These accent hues stay
distinct from `--primary` on purpose, so feature areas are recognisable.

## Voice & tone

Plain, warm, human — the same register the AI uses with customers. Short
sentences. No jargon. Money is talked about plainly ("you earn", "they
pay"), encouragement over corporate-speak. A smart 10-year-old should
understand any screen.

## Where it lives

- Tokens: `src/app/globals.css` (`html[data-theme="moldlane"]`).
- Theme catalog: `src/lib/themes.ts` (Moldlane is `DEFAULT_THEME`).
- Mobile nav: `src/components/layout/mobile-nav.tsx`.
- Primitives: `src/components/ui/*` (shadcn/base-ui, token-driven).
