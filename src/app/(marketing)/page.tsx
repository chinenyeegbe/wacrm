import Link from "next/link";
import {
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  LayoutDashboard,
  ArrowRight,
  Check,
  Plug,
  Contact,
  HeartHandshake,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Shared team inbox",
    body: "Your whole team works one WhatsApp number — assign chats, leave private notes, never drop a customer.",
  },
  {
    icon: Users,
    title: "Contacts & tags",
    body: "Every conversation builds a contact record. Tag, segment, add custom fields, import from CSV.",
  },
  {
    icon: GitBranch,
    title: "Sales pipelines",
    body: "Drag deals through stages on a Kanban board, linked straight to the chat that started them.",
  },
  {
    icon: Radio,
    title: "Broadcasts",
    body: "Send approved templates to hundreds of customers at once, with delivery and read tracking.",
  },
  {
    icon: Zap,
    title: "No-code automations",
    body: "Auto-reply, tag, route, and follow up. Build flows visually — no developer required.",
  },
  {
    icon: LayoutDashboard,
    title: "Real-time dashboard",
    body: "Response times, message volume, pipeline value, and activity — all in one live view.",
  },
];

const STEPS = [
  {
    icon: Plug,
    title: "Connect WhatsApp",
    body: "Link your WhatsApp Business number in minutes through the official Meta Cloud API.",
  },
  {
    icon: Contact,
    title: "Bring your contacts",
    body: "Import customers from a spreadsheet, or let new chats create contacts automatically.",
  },
  {
    icon: HeartHandshake,
    title: "Sell & support",
    body: "Reply faster, move deals forward, and keep every customer conversation in one place.",
  },
];

export default function MarketingHome() {
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
            Built on the official WhatsApp Business API
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Turn WhatsApp into your whole{" "}
            <span className="text-primary">customer engine</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {BRAND.name} gives local businesses a shared inbox, contacts, sales
            pipelines, broadcasts, and automations — all on the number your
            customers already message.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Get set up by an agent
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card to start · Self-hostable · Your data stays yours
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to run on WhatsApp
            </h2>
            <p className="mt-4 text-muted-foreground">
              One tool for the whole customer journey — from first message to
              closed deal and beyond.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
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
              Live in an afternoon
            </h2>
            <p className="mt-4 text-muted-foreground">
              Three steps from sign-up to selling — do it yourself or let an
              agent handle it.
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

      {/* Two audiences */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-8">
            <h3 className="text-xl font-semibold text-foreground">
              Run it yourself
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Comfortable with tech? Sign up and connect your number — you&apos;ll
              be sending messages in minutes.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {["Free to start", "Guided setup checklist", "No code required"].map(
                (li) => (
                  <li key={li} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {li}
                  </li>
                ),
              )}
            </ul>
            <Link
              href="/signup"
              className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-semibold text-primary hover:underline"
            >
              Create your account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-col rounded-2xl border border-primary/30 bg-primary-soft p-8">
            <h3 className="text-xl font-semibold text-foreground">
              Get set up by an agent
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Prefer a hand? A local {BRAND.name} agent visits your business,
              sets everything up, and shows your team how to use it.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {[
                "In-person onboarding",
                "Number + templates configured for you",
                "Local support you can call",
              ].map((li) => (
                <li key={li} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {li}
                </li>
              ))}
            </ul>
            <Link
              href="/agents"
              className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-semibold text-primary hover:underline"
            >
              Find out how <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to sell on WhatsApp?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join the local businesses running their sales and support on{" "}
            {BRAND.name}.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
