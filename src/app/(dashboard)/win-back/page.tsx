"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Loader2,
  Users,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WINBACK_WINDOWS, type WinbackWindow } from "@/lib/winback/dormant";

interface WinbackCustomer {
  conversation_id: string;
  name: string | null;
  phone: string | null;
  days_quiet: number;
}

export default function WinBackPage() {
  const [days, setDays] = useState<WinbackWindow>(30);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [customers, setCustomers] = useState<WinbackCustomer[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/winback?days=${days}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setCount(body?.count ?? 0);
        setCustomers((body?.customers as WinbackCustomer[]) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <RefreshCw className="size-6 text-primary" /> Bring customers back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These are people who bought or chatted with you before, then went
          quiet. A friendly nudge is the easiest sale you will make.
        </p>
      </div>

      {/* Window selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Quiet for at least</span>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {WINBACK_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                days === w
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary + CTA */}
      <div className="rounded-2xl border border-primary/20 bg-primary-soft p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Finding quiet customers…
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft-2 text-primary">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {count}
                </p>
                <p className="text-sm text-muted-foreground">
                  {count === 1 ? "customer has" : "customers have"} gone quiet
                  for {days}+ days
                </p>
              </div>
            </div>
            {count > 0 && (
              <Link
                href="/broadcasts/new"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Send them a message <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp rule note */}
      {!loading && count > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            WhatsApp only lets you message people outside the 24-hour window
            using an approved template. The button above starts a broadcast so
            it goes out the right way. We will help you write it.
          </span>
        </p>
      )}

      {/* List */}
      {!loading && count > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {customers.map((c) => (
              <div
                key={c.conversation_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name || c.phone || "Customer"}
                  </p>
                  {c.name && c.phone && (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {c.days_quiet} days quiet
                </span>
              </div>
            ))}
          </div>
          {count > customers.length && (
            <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
              Showing the {customers.length} longest-quiet. A broadcast can
              reach all {count}.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && count === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No quiet customers in this window
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a shorter window, or check back later. When customers go quiet,
            they will show up here so you can win them back.
          </p>
        </div>
      )}
    </div>
  );
}
