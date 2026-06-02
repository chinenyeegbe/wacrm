import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { BRAND } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how", label: "How it works" },
      { href: "/signup", label: "Get started" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Agents",
    links: [
      { href: "/agents", label: "Agent program" },
      { href: "/agents#how", label: "How it works" },
      { href: "/signup?role=agent", label: "Become an agent" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold text-foreground">
              {BRAND.name}
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {BRAND.tagline}. Built on the official WhatsApp Business API.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-foreground">
              {col.title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <p>WhatsApp is a trademark of Meta Platforms, Inc.</p>
        </div>
      </div>
    </footer>
  );
}
