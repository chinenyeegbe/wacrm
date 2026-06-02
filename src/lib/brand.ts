/**
 * Single source of truth for brand strings used across the marketing
 * site and app chrome. Centralised so renaming (or white-labelling a
 * fork) is a one-file change.
 */
export const BRAND = {
  name: "Moldlane",
  /** Used in <title> templates and hero copy. */
  tagline: "WhatsApp CRM for local businesses",
  description:
    "Moldlane turns WhatsApp into a complete CRM for local businesses — shared inbox, contacts, sales pipelines, broadcasts, and no-code automations. Get started yourself, or have a Moldlane agent set you up.",
  /** Primary public URL; mirrors NEXT_PUBLIC_SITE_URL when set. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.moldlane.com",
  email: "hello@moldlane.com",
} as const
