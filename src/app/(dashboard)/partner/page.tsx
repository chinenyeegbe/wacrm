'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Gift,
  Copy,
  Check,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
  Banknote,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCode } from '@/lib/referrals/codes';
import { DEFAULT_PARTNER_TIERS } from '@/lib/referrals/commission';
import type { Partner, ReferralEarning, PartnerPayout } from '@/types';

function formatMoney(minor: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(0)}`;
  }
}

export default function PartnerPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [referralUrl, setReferralUrl] = useState<string>('');
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/partners');
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (body?.partner) {
          setPartner(body.partner);
          setReferralUrl(body.referral_url ?? '');
          // Earnings are readable directly via RLS (partner owns them).
          const supabase = createClient();
          const { data } = await supabase
            .from('referral_earnings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          if (!cancelled) setEarnings((data as ReferralEarning[]) ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const join = async () => {
    setJoining(true);
    try {
      const res = await fetch('/api/partners', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || 'Could not join the partner program');
        return;
      }
      setPartner(body.partner);
      setReferralUrl(body.referral_url ?? '');
      toast.success('You are now a wacrm partner! 🎉');
    } finally {
      setJoining(false);
    }
  };

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — long-press to copy the link');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  // ---- Not a partner yet: the pitch + join button ----
  if (!partner) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-primary/20 bg-primary-soft p-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft-2">
            <Gift className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Earn by bringing businesses on board
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Share wacrm with shops and businesses you know. When they collect
            payments through it, you earn a slice of every sale —
            automatically, for as long as they stay. No cost to them, no cost
            to you.
          </p>
          <Button onClick={join} disabled={joining} className="mt-6">
            {joining ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Setting up…
              </>
            ) : (
              'Become a partner'
            )}
          </Button>
        </div>

        <TierLadder />
      </div>
    );
  }

  // ---- Partner dashboard ----
  const pending = earnings
    .filter((e) => e.status === 'accrued')
    .reduce((a, e) => a + e.amount_minor, 0);
  const currency = earnings[0]?.currency ?? 'NGN';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Gift className="size-6 text-primary" /> Earn
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your link. Earn a share of every sale your businesses collect.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Businesses referred"
          value={String(partner.referred_count)}
        />
        <StatCard
          icon={Wallet}
          label="Pending payout"
          value={formatMoney(pending, currency)}
        />
        <StatCard
          icon={TrendingUp}
          label="Lifetime earned"
          value={formatMoney(partner.total_earned_minor, currency)}
        />
      </div>

      {/* Cash out */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Banknote className="size-4 text-[var(--chart-2)]" />
          <p className="text-sm font-medium text-foreground">Cash out</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          You have{' '}
          <span className="font-semibold text-foreground tabular-nums">
            {formatMoney(pending, currency)}
          </span>{' '}
          ready to withdraw. Tell us where to send it.
        </p>
        <Textarea
          value={payoutDetails}
          onChange={(e) => setPayoutDetails(e.target.value)}
          placeholder={
            'e.g. Bank transfer — 0123456789 GTBank, Ada Eze\nor M-Pesa 0712 345 678'
          }
          className="mt-3 min-h-20 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={cashOut} disabled={cashingOut || pending <= 0}>
            {cashingOut ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Requesting…
              </>
            ) : (
              <>Cash out {formatMoney(pending, currency)}</>
            )}
          </Button>
        </div>

        {payouts.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Payout history
            </p>
            <div className="divide-y divide-border">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-foreground tabular-nums">
                    {formatMoney(p.amount_minor, p.currency)}
                  </span>
                  <span
                    className={
                      p.status === 'paid'
                        ? 'text-xs font-medium text-[var(--chart-2)]'
                        : p.status === 'rejected'
                          ? 'text-xs text-destructive'
                          : 'text-xs text-muted-foreground'
                    }
                  >
                    {p.status === 'pending' ? 'processing' : p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Referral link */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Your invite link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your code is{' '}
          <span className="font-mono text-primary">
            {formatCode(partner.code)}
          </span>
          . Send this link on WhatsApp, put it on a flyer, or add it to your
          status.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={referralUrl}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
          />
          <Button variant="outline" onClick={copyLink} className="shrink-0">
            {copied ? (
              <>
                <Check className="size-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Earnings list */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-medium text-foreground">
          Recent earnings
        </p>
        {earnings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No earnings yet. Share your link to get started — you&apos;ll earn
            the moment a business you referred collects a payment.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {earnings.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <span className="text-foreground">
                    {formatMoney(e.amount_minor, e.currency)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    on a {formatMoney(e.gross_minor, e.currency)} sale
                  </span>
                </div>
                <span
                  className={
                    e.status === 'paid'
                      ? 'text-xs font-medium text-[var(--chart-2)]'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TierLadder currentShare={partner.share_bps} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function TierLadder({ currentShare }: { currentShare?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">
        The more you bring, the bigger your share
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEFAULT_PARTNER_TIERS.map((t, i) => {
          const next = DEFAULT_PARTNER_TIERS[i + 1];
          const range = next ? `${t.min}–${next.min - 1}` : `${t.min}+`;
          const active = currentShare === t.shareBps;
          return (
            <div
              key={t.min}
              className={
                'rounded-lg border p-3 text-center ' +
                (active
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-background')
              }
            >
              <p className="text-lg font-bold text-foreground tabular-nums">
                {t.shareBps / 100}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {range} businesses
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Your share is taken from the platform fee — the businesses you refer
        never pay more.
      </p>
    </div>
  );
}
