# Moldlane design system

> Simple yet powerful, Notion-calm, but it earns its keep on a cheap
> Android phone on a 3G connection. Mobile-first, always.

## Brand idea

**Moldlane** = the *lane* you *mould* your business into, a guided path
from chaos (a phone full of chats) to a running machine (AI that sells and
collects). The visual language is **light, calm, and crafted**, Notion's
paper-and-ink restraint, warmed up with earth tones. Hand-made, human,
trustworthy; not another cold blue SaaS.

## Color, warm, earthy, minimal

A **light** system on a bone canvas with **one** warm accent. Restraint is
the rule: terracotta does the work, sage means "good things" (money /
success), rust is terracotta's deep state, and everything else is warm
neutral.

| Role | Name | Hex | oklch token | Use |
| --- | --- | --- | --- | --- |
| Canvas | Bone | `#F7F5F0` | `--background` | App background |
| Ink | Warm near-black |, | `--foreground` | Text (never pure black) |
| **Primary** | **Terracotta** | `#C87A50` | `--primary` | Buttons, active nav, links, focus |
| Primary deep | **Rust** | `#B3543A` | `--primary-hover` | Hover / active / emphasis |
| **Secondary** | **Sage** | `#7A9A85` | `--chart-2` | **Positive / money / success** ("paid", earnings) |
| Surface | Near-white |, | `--card` | Cards, popovers |
| Muted | Warm taupe |, | `--muted`, `--border` | Surfaces, dividers, hints |
| Error | Clear red |, | `--destructive` | Errors only, kept distinct from terracotta so "danger" never reads as "brand" |

Why this split: you gave four colors, but they're really **one earthy
family + a complement**. Terracotta (`#C87A50`) and rust (`#B3543A`) are
light/deep shades of the *same* hue, so using rust as the hover/emphasis
state keeps the look minimal instead of busy. Sage (`#7A9A85`) is the
natural complement (green opposite orange), reserved for positive/money
signals so it carries *meaning*, not decoration. Bone is the Notion paper.

Implemented as the **`moldlane` theme** (default) in `src/app/globals.css`;
`:root` mirrors it for flash-free first paint. Five alternate themes remain
in Settings → Appearance. Components consume tokens (`bg-primary`,
`text-primary`, `bg-primary-soft`, `text-primary-hover`, `border-border`),
never hard-coded colors, theming is one CSS block.

**Accessibility:** warm-ink-on-bone is ~12:1; bone-white on terracotta and
on rust both clear WCAG AA for buttons. Sage is used for emphasis/large
text and status pills, paired with a label so colour isn't the only signal.

**Note:** the rest of the app (dashboard, inbox, etc.) is still
dark-hardcoded (`slate-*`) from the upstream template; the auth flow is
converted to the light token system as the reference implementation. The
dashboard sweep to tokens is the next design task.

## Typography

- **Inter** (variable, self-hosted via `next/font`), one family, no
  network round-trip, excellent at small sizes on cheap screens.
- Scale (Tailwind): page title `text-2xl font-bold`; section `text-base
  font-semibold`; body `text-sm`; meta/hints `text-xs`; micro-labels
  `text-[10px] uppercase tracking-wide`.
- **Tabular numerals** for money, amounts should never jitter as they
  change.

## Spacing, radius, motion

- Radius: `--radius: 0.7rem` (slightly softer than the base) → friendly,
  not corporate-sharp.
- Spacing: 4px grid (Tailwind defaults). Generous whitespace = the "calm".
- Motion: short and purposeful (150–200ms). No decorative animation that
  burns battery / CPU on low-end devices. Respect
  `prefers-reduced-motion`.

## Mobile-first rules (non-negotiable, Africa is mobile-first)

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

`lucide-react` throughout, one consistent stroke-based set. Feature
accents reuse the palette so the app stays cohesive: Earn/partner = `Gift`
(terracotta primary), Payments/money/success = sage (`--chart-2`), AI =
`Sparkles` (terracotta). Avoid introducing new hues, the earth family +
sage is the whole vocabulary.

## Voice & tone

Plain, warm, human, the same register the AI uses with customers. Short
sentences. No jargon. Money is talked about plainly ("you earn", "they
pay"), encouragement over corporate-speak. A smart 10-year-old should
understand any screen.

## Where it lives

- Tokens: `src/app/globals.css` (`html[data-theme="moldlane"]`).
- Theme catalog: `src/lib/themes.ts` (Moldlane is `DEFAULT_THEME`).
- Mobile nav: `src/components/layout/mobile-nav.tsx`.
- Primitives: `src/components/ui/*` (shadcn/base-ui, token-driven).
