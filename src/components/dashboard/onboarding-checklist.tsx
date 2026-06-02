"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  Rocket,
} from "lucide-react";
import type { ComponentType } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Device-scoped, like the theme pick. Onboarding is a nudge, not a
// gate — once the user dismisses it (or finishes every step) it stays
// gone on this device.
const DISMISS_KEY = "moldlane.onboarding.dismissed";

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Returns true when this step is already satisfied for the user. */
  check: (db: ReturnType<typeof createClient>) => Promise<boolean>;
}

// A single COUNT(head) per step — cheap, and RLS scopes each to the
// signed-in user. Any error (missing table, offline) is treated as
// "not done yet" so the checklist degrades quietly instead of throwing.
async function hasRows(
  db: ReturnType<typeof createClient>,
  table: string,
): Promise<boolean> {
  try {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

const STEPS: Step[] = [
  {
    key: "whatsapp",
    label: "Connect WhatsApp",
    hint: "Link your WhatsApp Business number so you can send and receive messages.",
    href: "/settings?tab=whatsapp",
    icon: MessageSquare,
    check: (db) => hasRows(db, "whatsapp_config"),
  },
  {
    key: "contacts",
    label: "Add your first contact",
    hint: "Import customers from a spreadsheet or add one by hand.",
    href: "/contacts",
    icon: Users,
    check: (db) => hasRows(db, "contacts"),
  },
  {
    key: "pipeline",
    label: "Create a deal",
    hint: "Track an opportunity through your sales pipeline.",
    href: "/pipelines",
    icon: GitBranch,
    check: (db) => hasRows(db, "deals"),
  },
  {
    key: "broadcast",
    label: "Send a broadcast",
    hint: "Reach many customers at once with an approved template.",
    href: "/broadcasts/new",
    icon: Radio,
    check: (db) => hasRows(db, "broadcasts"),
  },
  {
    key: "automation",
    label: "Set up an automation",
    hint: "Auto-reply, tag, and follow up without lifting a finger.",
    href: "/automations/new",
    icon: Zap,
    check: (db) => hasRows(db, "automations"),
  },
];

export function OnboardingChecklist() {
  const [done, setDone] = useState<Record<string, boolean> | null>(null);
  // Read the dismissal lazily (SSR-safe) so we never setState in an
  // effect. On the server we assume hidden; the first client render
  // also renders nothing (done is still null), so there's no hydration
  // mismatch even if the device hasn't dismissed it.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const load = useCallback(() => {
    const db = createClient();
    Promise.all(STEPS.map((s) => s.check(db)))
      .then((results) => {
        const map: Record<string, boolean> = {};
        STEPS.forEach((s, i) => (map[s.key] = results[i]));
        setDone(map);
      })
      .catch(() => setDone({}));
  }, []);

  useEffect(() => {
    if (!dismissed) load();
  }, [dismissed, load]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed || done === null) return null;

  const completed = STEPS.filter((s) => done[s.key]).length;
  // Everything finished — no reason to keep nagging.
  if (completed === STEPS.length) return null;

  const pct = Math.round((completed / STEPS.length) * 100);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Rocket className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Get set up
            </h2>
            <p className="text-sm text-muted-foreground">
              {completed} of {STEPS.length} done — finish these to get the most
              out of your CRM.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="mt-4 flex flex-col gap-1">
        {STEPS.map((s) => {
          const isDone = done[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-secondary/50",
                  isDone && "opacity-60",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium text-foreground",
                      isDone && "line-through",
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.hint}
                  </span>
                </span>
                {!isDone && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
