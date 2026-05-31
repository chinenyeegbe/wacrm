import type { Metadata } from "next";
import type { ReactNode } from "react";

// Shared metadata for auth pages (login / signup / forgot-password).
// None of these should be indexed, they'd compete with the marketing
// landing in SERPs and offer nothing to a searcher who hasn't already
// signed up. Each page still gets its own <title> via its own
// metadata.title override below the route group layout.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}

// Auth pages instantiate the Supabase browser client at module/render
// time, which needs NEXT_PUBLIC_SUPABASE_* at runtime. Static
// prerendering at build time has no such env and throws
// ("Your project's URL and API key are required"). These forms are
// inherently dynamic (per-session auth) and must never be cached, so we
// opt the whole (auth) segment out of static generation. Applies to
// login, signup, and forgot-password.
export const dynamic = "force-dynamic";
