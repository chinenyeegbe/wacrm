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
import { DEFAULT_PARTNER_TIERS } from "@/lib/referrals/commission";

// Agent landing — speaks ONLY to the earner persona (someone who wants to
// make money by bringing local businesses onto Moldlane). The merchant story
// lives on / so each page converts one audience.
export const metadata: Metadata = {
  title: "Earn with Moldlane — get paid to grow local businesses",
  description:
    "Sign up shops and businesses you know. Earn a share of every sale they make through Moldlane — every month, for as long as they stay. No cost to start.",
  robots: { index: true, follow: true },
};

const CTA = { label: "Start earning", href: "/signup" };

export default function AgentsPage() {
  return (
    <MarketingShell persona="agent" cta={CTA}>
      {/* ---------- Hero ---------- */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            <Gift className="h-3.5 w-3.5" />
            Moldlane Partners
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Get paid to help businesses{" "}
            <span className="text-primary">near you grow</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Show a shop owner how Moldlane runs their WhatsApp and collects their
            money. When they make sales, you earn a slice — every month, for as
            long as they stay. Your phone is all you need.
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
            Free to join. <span className="font-medium text-foreground">No fees, no targets, no risk.</span>
          </p>
        </div>
      </section>

      {/* ---------- Why it pays ---------- */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: Wallet,
              title: "Recurring income",
              body: "Not a one-off bonus. You earn every time your businesses get paid — month after month.",
            },
            {
              icon: Smartphone,
              title: "Sell from your phone",
              body: "Share a link on WhatsApp status, in groups, or face-to-face. Setup takes minutes.",
            },
            {
              icon: TrendingUp,
              title: "Earn more as you grow",
              body: "The more businesses you bring, the bigger your share of every sale.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Three steps to your first payout
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "1",
              icon: Share2,
              title: "Grab your link",
              body: "Join free and get your own invite link and code in seconds.",
            },
            {
              n: "2",
              icon: Users,
              title: "Sign up businesses",
              body: "Share it with shops you know. They start free — an easy yes.",
            },
            {
              n: "3",
              icon: Wallet,
              title: "Cash out",
              body: "Earn a share of their sales and withdraw to your bank or mobile money.",
            },
          ].map((step) => (
            <div key={step.n} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.n}
                </span>
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Earnings ladder ---------- */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            The more you bring, the more you keep
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
            Your share of the platform fee grows with the number of active
            businesses you&apos;ve signed up. It never costs them more.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {DEFAULT_PARTNER_TIERS.map((t, i) => {
              const next = DEFAULT_PARTNER_TIERS[i + 1];
              const range = next ? `${t.min}–${next.min - 1}` : `${t.min}+`;
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

      {/* ---------- Who it's for ---------- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Perfect if you&apos;re…
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {[
              "A student or hustler who knows lots of local businesses",
              "Already helping shops with their phones or social media",
              "Looking for income you can earn from your own phone",
              "Good at talking to people in your community",
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
      </section>

      {/* ---------- Use it for your own hustle too ---------- */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Got a small hustle of your own?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sell hair, jewellery, snacks, or run a service on the side? Use
              Moldlane to look after your <span className="font-medium text-foreground">own</span>{" "}
              customers too — answer faster, sell more, and win back the regulars
              who forgot to come back. Same account, no extra cost.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
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
