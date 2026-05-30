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
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { formatCode } from '@/lib/referrals/codes';
import { DEFAULT_PARTNER_TIERS } from '@/lib/referrals/commission';
import type { Partner, ReferralEarning } from '@/types';

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
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  // ---- Not a partner yet: the pitch + join button ----
  if (!partner) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Gift className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Earn by bringing businesses on board
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Share wacrm with shops and businesses you know. When they collect
            payments through it, you earn a slice of every sale —
            automatically, for as long as they stay. No cost to them, no cost
            to you.
          </p>
          <Button
            onClick={join}
            disabled={joining}
            className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
          >
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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Gift className="size-6 text-primary" /> Earn
        </h1>
        <p className="mt-1 text-sm text-slate-400">
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

      {/* Referral link */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-sm font-medium text-slate-200">Your invite link</p>
        <p className="mt-1 text-xs text-slate-500">
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
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200"
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
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="mb-3 text-sm font-medium text-slate-200">
          Recent earnings
        </p>
        {earnings.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No earnings yet. Share your link to get started — you&apos;ll earn
            the moment a business you referred collects a payment.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {earnings.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <span className="text-slate-200">
                    {formatMoney(e.amount_minor, e.currency)}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    on a {formatMoney(e.gross_minor, e.currency)} sale
                  </span>
                </div>
                <span
                  className={
                    e.status === 'paid'
                      ? 'text-xs text-emerald-400'
                      : 'text-xs text-amber-400'
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function TierLadder({ currentShare }: { currentShare?: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-sm font-medium text-slate-200">
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
                  ? 'border-primary bg-primary/10'
                  : 'border-slate-800 bg-slate-900/60')
              }
            >
              <p className="text-lg font-bold text-white">
                {t.shareBps / 100}%
              </p>
              <p className="text-[11px] text-slate-500">{range} businesses</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-600">
        Your share is taken from the platform fee — the businesses you refer
        never pay more.
      </p>
    </div>
  );
}
