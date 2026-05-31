import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock,
  Languages,
  CreditCard,
  RefreshCw,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingShell } from "@/components/marketing/marketing-shell";

// Business landing — speaks ONLY to the merchant persona.
//
// Positioning rule (from the founder): sell the WHAT and the WHY, never the
// HOW. Customers don't care if it's AI, a human, or both — they care that
// their customers get supported, sold to, and brought back, so revenue goes
// up and nobody drifts to a competitor. So: no "AI" in the pitch, no
// over-explaining the mechanism, business-casual voice, say only what's
// needed and let the details reveal themselves later.
export const metadata: Metadata = {
  title: "Moldlane — never lose a customer to a slow reply",
  description:
    "Moldlane keeps every customer on your WhatsApp answered, every buyer closed, and brings back the ones who've gone quiet — even when you're too busy. Pay only when you get paid.",
  robots: { index: true, follow: true },
};

const CTA = { label: "Start free", href: "/signup" };

export default async function HomePage() {
  // Logged-in merchants skip the pitch and go straight to work.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <MarketingShell persona="business" cta={CTA}>
      {/* ---------- Hero ---------- */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            Works on the WhatsApp you already use
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Never lose a customer to a{" "}
            <span className="text-primary">slow reply</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            You can&apos;t be on your phone all day — you get busy, tired,
            overwhelmed. Moldlane keeps every customer answered, every buyer
            closed, and nudges the quiet ones to come back. Even while you
            sleep.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={CTA.href}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:w-auto"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border px-6 text-base font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No monthly fee.{" "}
            <span className="font-medium text-foreground">
              You only pay when you get paid.
            </span>
          </p>
        </div>
      </section>

      {/* ---------- The three jobs, framed by the WHY ---------- */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              pain: "A question sits unanswered",
              fix: "Every customer gets a quick, friendly reply — so they don't message your competitor instead.",
            },
            {
              pain: "A ready buyer waits too long",
              fix: "Prospects and regulars get sold to on the spot, in their own language.",
            },
            {
              pain: "Old customers forget you",
              fix: "Quiet customers get a warm nudge to come back — the marketing you never have time to do.",
            },
          ].map((item) => (
            <div
              key={item.pain}
              className="rounded-xl border border-border bg-card p-5"
            >
              <p className="text-sm font-medium text-muted-foreground line-through decoration-destructive/50">
                {item.pain}
              </p>
              <p className="mt-2 text-sm text-foreground">{item.fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works (their experience, not our tech) ---------- */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Set it up in an afternoon
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
          Nothing changes for your customers — they keep chatting on WhatsApp.
          You just stop dropping the ball.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "1",
              title: "Connect your WhatsApp",
              body: "Add your number, your prices, and your hours once.",
            },
            {
              n: "2",
              title: "Make it yours",
              body: "Decide how hands-on you want to be — review everything, or let it run.",
            },
            {
              n: "3",
              title: "Get back to business",
              body: "Customers are looked after around the clock. You step in only when it matters.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="relative rounded-xl border border-border bg-card p-6"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.n}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- What you get (outcomes) ---------- */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Looks after your customers like you would
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Always answered",
                body: "Never miss a midnight buyer or a busy-day rush. Replies come in seconds, every day.",
              },
              {
                icon: Languages,
                title: "Speaks their language",
                body: "English, Pidgin, Swahili, French, Hausa, Yoruba, Arabic — it matches each customer.",
              },
              {
                icon: CreditCard,
                title: "Takes payment in the chat",
                body: "Sends a secure pay link right where they're talking, and confirms it for you.",
              },
              {
                icon: RefreshCw,
                title: "Brings customers back",
                body: "Reaches out to people who've gone quiet with a friendly reminder or a small offer.",
              },
              {
                icon: Users,
                title: "One inbox for your team",
                body: "You and your staff on one number — with notes, tags, and a clear sales pipeline.",
              },
              {
                icon: ShieldCheck,
                title: "Stays professional",
                body: "Warm, human replies that sound like you — and your customers' details stay private.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing promise ---------- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-primary-soft p-8 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Pay nothing until it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            No subscription. No setup fee. Moldlane takes a small cut only when
            a sale is paid through it — so we earn only when you do.
          </p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2 text-left text-sm">
            {[
              "Free to start, free to set up",
              "A small fee only on collected sales",
              "Flat plans available for larger teams",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href={CTA.href}
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
