import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Wallet,
  GraduationCap,
  Users,
  ClipboardCheck,
  Headphones,
  TrendingUp,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Become an agent",
  description: `Earn by signing up local businesses to ${BRAND.name}. Walk your neighborhood, onboard shops onto WhatsApp CRM, and earn on every business you bring on.`,
};

const BENEFITS = [
  {
    icon: Wallet,
    title: "Earn on every signup",
    body: "Get paid for each business you onboard, plus ongoing rewards as they keep using Moldlane.",
  },
  {
    icon: MapPin,
    title: "Work your own area",
    body: "Sign up shops, salons, and traders in the neighborhood you already know. Flexible hours.",
  },
  {
    icon: GraduationCap,
    title: "Full training",
    body: "We teach you the product and the pitch. No tech background needed — just hustle.",
  },
  {
    icon: Headphones,
    title: "Real support",
    body: "A dedicated team backs you up on setup, questions, and anything your businesses need.",
  },
];

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "Apply & get approved",
    body: "Sign up as an agent and complete a short onboarding. Get your agent toolkit.",
  },
  {
    icon: Users,
    title: "Sign up businesses",
    body: "Visit local businesses, show them Moldlane, and set them up on WhatsApp right there.",
  },
  {
    icon: TrendingUp,
    title: "Earn & grow",
    body: "Earn on every business you onboard, and keep earning as they grow with the product.",
  },
];

export default function AgentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,var(--primary-soft),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {BRAND.name} Agent Program
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Earn by getting local businesses{" "}
            <span className="text-primary">online</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Walk your neighborhood, sign up shops and traders to {BRAND.name},
            and earn on every business you bring on board. Set them up on
            WhatsApp right from your phone.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?role=agent"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Become an agent
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              See the product
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why become an agent?
            </h2>
            <p className="mt-4 text-muted-foreground">
              A flexible way to earn while helping the businesses around you
              grow.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Three steps to start earning as a {BRAND.name} agent.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="absolute right-5 top-5 text-5xl font-bold text-primary-soft-2">
                  {i + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Start earning in your area
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join the agents helping local businesses sell on WhatsApp with{" "}
            {BRAND.name}.
          </p>
          <Link
            href="/signup?role=agent"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Become an agent <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
