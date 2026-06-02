import type { Metadata } from "next";
import Link from "next/link";
import {
  Gift,
  Wallet,
  TrendingUp,
  Users,
  Share2,
  ArrowRight,
  Check,
  Smartphone,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Faq } from "@/components/marketing/faq";
import { RotatingText } from "@/components/marketing/rotating-text";
import { Reveal } from "@/components/marketing/reveal";
import { AGENT_HERO } from "@/lib/marketing/hero-variants";
import { DEFAULT_PARTNER_TIERS } from "@/lib/referrals/commission";

const FAQ_ITEMS = [
  {
    q: "Is it free to join?",
    a: "Yes. Joining is free. There are no fees and no targets. You only ever earn, you never pay.",
  },
  {
    q: "When do I get paid?",
    a: "You earn every time a business you signed up makes a paid sale, every month they keep using Moldlane.",
  },
  {
    q: "How do I get my money?",
    a: "When you are ready, you cash out your earnings to your bank account or mobile money.",
  },
  {
    q: "Is this one of those schemes?",
    a: "No. You earn from real sales only. There is no joining fee, and you are not paid for recruiting other people.",
  },
  {
    q: "Do I need experience?",
    a: "No. If you know local businesses and you are good with people, you can do this. We show you how.",
  },
  {
    q: "What do I actually have to do?",
    a: "Share your link, and help a shop get started. That is it. The tool does the work of answering and selling.",
  },
  {
    q: "How much can I earn?",
    a: "It grows with how many businesses you bring. The more active businesses you sign up, the bigger your share of every sale.",
  },
];

// Agent landing. One audience only: the person who wants to earn by bringing
// local businesses onto Moldlane. Plain, simple English. The business pitch
// lives on / so each page converts a single audience.
export const metadata: Metadata = {
  title: "Earn with Moldlane: get paid to grow local businesses",
  description:
    "Sign up shops you know. Earn a share of every sale they make through Moldlane, every month, for as long as they stay. Free to join. All you need is your phone.",
  robots: { index: true, follow: true },
};

const CTA = { label: "Start earning", href: "/signup" };

export default function AgentsPage() {
  return (
    <MarketingShell persona="agent" cta={CTA}>
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            <Gift className="h-3.5 w-3.5" />
            Moldlane Partners
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Help local shops{" "}
            <RotatingText sets={AGENT_HERO} className="text-primary" />
            <br />
            and get paid
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Show shops you know how Moldlane works. When they make sales, you
            earn a share. Every month, for as long as they stay. All you need is
            your phone.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={CTA.href}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:w-auto"
            >
              Start earning <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border px-6 text-base font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              How it works
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Free to join.{" "}
            <span className="font-medium text-foreground">
              No fees. No targets.
            </span>
          </p>
        </div>
      </section>

      {/* Why it pays */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: Wallet,
              title: "Money every month",
              body: "Not a one-time bonus. You earn each time your businesses get paid.",
            },
            {
              icon: Smartphone,
              title: "Sell from your phone",
              body: "Share a link on WhatsApp or in person. Setup takes minutes.",
            },
            {
              icon: TrendingUp,
              title: "Earn more over time",
              body: "The more businesses you bring, the bigger your share.",
            },
          ].map((item, i) => (
            <Reveal
              key={item.title}
              delayMs={i * 80}
              className="rounded-xl border border-border bg-card p-5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Three steps to your first payout
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "1",
              icon: Share2,
              title: "Get your link",
              body: "Join free and get your own invite link in seconds.",
            },
            {
              n: "2",
              icon: Users,
              title: "Sign up businesses",
              body: "Share it with shops you know. They start free, so it is an easy yes.",
            },
            {
              n: "3",
              icon: Wallet,
              title: "Cash out",
              body: "Earn from their sales and withdraw to your bank or mobile money.",
            },
          ].map((step, i) => (
            <Reveal
              key={step.n}
              delayMs={i * 80}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.n}
                </span>
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Earnings ladder */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            The more you bring, the more you keep
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
            Your share grows with the number of businesses you sign up. It never
            costs them more.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {DEFAULT_PARTNER_TIERS.map((t, i) => {
              const next = DEFAULT_PARTNER_TIERS[i + 1];
              const range = next ? `${t.min} to ${next.min - 1}` : `${t.min}+`;
              return (
                <div
                  key={t.min}
                  className="rounded-xl border border-border bg-card p-5 text-center"
                >
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {t.shareBps / 100}%
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {range} businesses
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use it for your own business too */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Got a small business too?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sell hair, clothes, food, or run a service on the side? Use Moldlane
            for your own customers too. Answer faster, sell more, and bring
            people back. Same account. No extra cost.
          </p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              This is for you if
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                "You know a lot of local businesses",
                "You already help shops with their phones or social media",
                "You want money you can earn from your phone",
                "You are good with people",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ / objection handling */}
      <Faq title="Questions people ask" items={FAQ_ITEMS} />

      {/* Final CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-primary-soft p-8 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Start earning this week
            </h2>
            <p className="mt-3 text-muted-foreground">
              Join free, get your link, and sign up your first business today.
            </p>
            <Link
              href={CTA.href}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Start earning <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
