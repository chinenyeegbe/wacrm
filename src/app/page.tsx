import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageSquare,
  Clock,
  Languages,
  CreditCard,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingShell } from "@/components/marketing/marketing-shell";

// Business landing — speaks ONLY to the merchant persona (a shop/SME owner
// drowning in WhatsApp). The agent/earner story lives on /agents so each
// page has a single audience and a single conversion goal.
export const metadata: Metadata = {
  title: "Moldlane — your WhatsApp, run by AI",
  description:
    "Moldlane answers every WhatsApp message, sells in your customer's language, and collects payment — 24/7. No monthly fee; pay only when you get paid.",
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
            <Sparkles className="h-3.5 w-3.5" />
            Runs on WhatsApp you already use
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Your WhatsApp, run by an AI that{" "}
            <span className="text-primary">sells while you sleep</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Moldlane replies to every customer in seconds — in their own
            language — answers questions from your price list, and sends a
            payment link right in the chat. You wake up to sales, not a
            backlog.
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
            No monthly fee. <span className="font-medium text-foreground">You only pay a small fee when you get paid.</span>
          </p>
        </div>
      </section>

      {/* ---------- Problem → relief ---------- */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              pain: "“How much?” fifty times a day",
              fix: "AI answers instantly from your price list — every time.",
            },
            {
              pain: "Leads go cold overnight",
              fix: "It replies at 2am, in Pidgin, Swahili, French — whatever they speak.",
            },
            {
              pain: "Chasing payments",
              fix: "It sends a pay link in the chat and confirms the moment money lands.",
            },
          ].map((item) => (
            <div key={item.pain} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground line-through decoration-destructive/50">
                {item.pain}
              </p>
              <p className="mt-2 text-sm text-foreground">{item.fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Live in an afternoon
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
          No new app for your customers. They keep chatting on WhatsApp — the AI
          works behind the scenes.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "1",
              title: "Connect your WhatsApp",
              body: "Link your business number and paste your catalogue, prices, and hours once.",
            },
            {
              n: "2",
              title: "Turn the AI on",
              body: "Pick how much it does alone — draft-only, AI + you, or fully automatic.",
            },
            {
              n: "3",
              title: "Get paid",
              body: "It answers, closes, and sends pay links. You handle only what needs a human.",
            },
          ].map((step) => (
            <div key={step.n} className="relative rounded-xl border border-border bg-card p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.n}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Feature grid ---------- */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Everything your shop needs, in one chat
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Answers 24/7",
                body: "Never miss a midnight buyer. Replies in seconds, every day.",
              },
              {
                icon: Languages,
                title: "Speaks their language",
                body: "English, Pidgin, Swahili, French, Hausa, Yoruba, Arabic — it matches the customer.",
              },
              {
                icon: CreditCard,
                title: "Collects payment",
                body: "Sends a secure pay link in the chat. Confirms automatically.",
              },
              {
                icon: Sparkles,
                title: "Knows your business",
                body: "Quotes your real prices and policies. Never makes things up.",
              },
              {
                icon: MessageSquare,
                title: "One shared inbox",
                body: "You and your team on one number, with notes, tags, and a sales pipeline.",
              },
              {
                icon: ShieldCheck,
                title: "Safe by default",
                body: "Hides card numbers from the AI, and you stay in control of every send.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5">
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
