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
import { Faq } from "@/components/marketing/faq";
import { RotatingText } from "@/components/marketing/rotating-text";
import { BUSINESS_HERO } from "@/lib/marketing/hero-variants";

const FAQ_ITEMS = [
  {
    q: "Will it sound like a robot to my customers?",
    a: "No. The replies are warm and human, in the customer's own language. If you want, you can read and approve every message before it goes out.",
  },
  {
    q: "Do my customers need to download anything?",
    a: "No. They keep chatting on the same WhatsApp they already use. Nothing changes for them.",
  },
  {
    q: "What does it cost?",
    a: "It is free to start and free to set up. You pay a small fee only when a sale is paid through Moldlane. No monthly fee.",
  },
  {
    q: "What if it replies with the wrong thing?",
    a: "You are always in control. Start by checking every reply yourself, then let it do more as you trust it. You can pause it any time.",
  },
  {
    q: "Is my customers' information safe?",
    a: "Yes. Your customers' details stay private, and card numbers are hidden. Your data is yours.",
  },
  {
    q: "How long does it take to set up?",
    a: "About an afternoon. You add your number, your prices, and your hours once, and you are ready.",
  },
  {
    q: "Can my staff use it too?",
    a: "Yes. You and your team share one number, with notes, tags, and a simple sales board so nothing slips.",
  },
];

// Business landing. One audience only: the shop / business owner.
//
// Copy rules: sell the WHAT and the WHY, not the HOW (no "AI" talk, no
// explaining the mechanism). Plain, simple English for a wide, ESL
// audience. Short sentences. Say only what's needed; details come later.
export const metadata: Metadata = {
  title: "Moldlane: answer every customer on WhatsApp",
  description:
    "Moldlane replies to every customer on your WhatsApp, helps them buy, and brings back the ones who went quiet. Day and night. You only pay when you get paid.",
  robots: { index: true, follow: true },
};

const CTA = { label: "Start free", href: "/signup" };

export default async function HomePage() {
  // Logged-in owners skip the pitch and go straight to work.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <MarketingShell persona="business" cta={CTA}>
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            Works on the WhatsApp you already use
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            WhatsApp that helps you
            <br />
            <RotatingText sets={BUSINESS_HERO} className="text-primary" />
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            You can&apos;t be on your phone all day. Moldlane replies to every
            customer fast, helps them buy, and brings back the ones who went
            quiet. Day and night.
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

      {/* The three jobs */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              title: "Reply fast",
              body: "Customers get a quick answer, so they do not go to someone else.",
            },
            {
              title: "Sell more",
              body: "It helps people buy, in their own language, right there in the chat.",
            },
            {
              title: "Bring people back",
              body: "It reminds quiet customers to come back. The marketing you never have time to do.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Set up in one afternoon
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
          Nothing changes for your customers. They keep chatting on WhatsApp.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "1",
              title: "Connect WhatsApp",
              body: "Add your number, your prices, and your hours. You only do this once.",
            },
            {
              n: "2",
              title: "Choose your style",
              body: "Check every message yourself, or let it run on its own. Your call.",
            },
            {
              n: "3",
              title: "Get back to work",
              body: "Your customers are looked after all day. You step in only when you want to.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-xl border border-border bg-card p-6"
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

      {/* What you get */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Looks after your customers like you would
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Always on",
                body: "Replies in seconds, any time of day, every day.",
              },
              {
                icon: Languages,
                title: "Any language",
                body: "English, Pidgin, Swahili, French, Hausa, Yoruba, and more.",
              },
              {
                icon: CreditCard,
                title: "Takes payment",
                body: "Sends a safe pay link in the chat and confirms it for you.",
              },
              {
                icon: RefreshCw,
                title: "Brings people back",
                body: "Messages old customers with a friendly reminder or a small offer.",
              },
              {
                icon: Users,
                title: "One inbox",
                body: "You and your team on one number, with notes, tags, and a simple sales board.",
              },
              {
                icon: ShieldCheck,
                title: "Sounds like you",
                body: "Friendly, human replies. Your customers' details stay private.",
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

      {/* FAQ / objection handling */}
      <Faq title="Questions people ask" items={FAQ_ITEMS} />

      {/* Pricing promise */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-primary-soft p-8 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Pay nothing until it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            No subscription. No setup fee. You pay a small amount only when a
            sale is paid through Moldlane. We earn only when you do.
          </p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2 text-left text-sm">
            {[
              "Free to start and free to set up",
              "A small fee only on paid sales",
              "Bigger team? Ask about a flat plan.",
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
