"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/hooks/use-theme";

/**
 * Toaster wrapper that follows the active light/dark mode.
 *
 * sonner's `theme` prop and surface colors are static once rendered,
 * and the root layout is a Server Component, so we read the mode here
 * (client) and drive both the sonner theme and the toast surface from
 * the same CSS tokens the rest of the app uses. Result: toasts are
 * dark on dark, light on light, with no separate palette to maintain.
 */
export function ThemedToaster() {
  const { mode } = useTheme();
  return (
    <Toaster
      theme={mode}
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          border: "1px solid var(--border)",
          color: "var(--popover-foreground)",
        },
      }}
    />
  );
}
