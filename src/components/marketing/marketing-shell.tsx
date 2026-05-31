import Link from "next/link";
import { MessageSquare } from "lucide-react";

/**
 * Marketing shell — a slim public nav + footer wrapping the landing pages.
 *
 * Deliberately minimal: a marketing page converts best with ONE job and few
 * distractions, so the nav carries the logo, a single quiet cross-link to
 * the *other* persona's page, and the page's primary CTA. Server component —
 * no client JS, fast on a cheap phone.
 */

type Persona = "business" | "agent";

interface MarketingShellProps {
  /** Which landing this is — drives the cross-link + primary CTA. */
  persona: Persona;
  /** The primary action (label + href) shown in the nav and footer. */
  cta: { label: string; href: string };
  children: React.ReactNode;
}

export function MarketingShell({ persona, cta, children }: MarketingShellProps) {
  const crossLink =
    persona === "business"
      ? { label: "Earn with Moldlane →", href: "/agents" }
      : { label: "For businesses →", href: "/" };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              Moldlane
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href={crossLink.href}
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              {crossLink.label}
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href={cta.href}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {cta.label}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <span>© {new Date().getFullYear()} Moldlane</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              For businesses
            </Link>
            <Link href="/agents" className="hover:text-foreground">
              Earn with Moldlane
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
