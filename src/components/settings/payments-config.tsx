'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CreditCard, CheckCircle2, CircleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { PaymentProvider } from '@/types';

interface LoadedConfig {
  provider: PaymentProvider;
  manual_instructions: string | null;
  default_currency: string;
  platform_fee_bps: number;
  status: 'connected' | 'disconnected';
  has_secret: boolean;
}

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  manual: 'Manual (bank / mobile money)',
};

export function PaymentsConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<PaymentProvider>('manual');
  const [secretKey, setSecretKey] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [manualInstructions, setManualInstructions] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [status, setStatus] = useState<'connected' | 'disconnected'>(
    'disconnected',
  );
  const [feeBps, setFeeBps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/payments/config');
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        const cfg = body?.config as LoadedConfig | null;
        if (cfg) {
          setProvider(cfg.provider);
          setManualInstructions(cfg.manual_instructions ?? '');
          setCurrency(cfg.default_currency ?? 'NGN');
          setStatus(cfg.status);
          setHasSecret(cfg.has_secret);
          setFeeBps(cfg.platform_fee_bps ?? 0);
        }
      } catch {
        // First-time / no config, fine.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          secret_key: secretKey || undefined,
          manual_instructions: manualInstructions || undefined,
          default_currency: currency,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || `Save failed: HTTP ${res.status}`);
        return;
      }
      setStatus(body.status);
      if (secretKey) {
        setHasSecret(true);
        setSecretKey('');
      }
      toast.success('Payment settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const needsKey = provider === 'paystack' || provider === 'flutterwave';

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <CreditCard className="size-4 text-emerald-400" />
          Payments
          {status === 'connected' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <CheckCircle2 className="size-3" />
              Connected
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Let the CRM send payment links right inside the chat, so the AI
          doesn&apos;t just close the sale, it collects. Connect a gateway, or
          start with manual bank / mobile-money instructions.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Provider */}
        <div className="space-y-2">
          <Label className="text-foreground">Provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as PaymentProvider)}
            disabled={loading || saving}
            className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
          >
            {(Object.keys(PROVIDER_LABEL) as PaymentProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        {needsKey && (
          <div className="space-y-2">
            <Label htmlFor="pay-secret" className="text-foreground">
              {PROVIDER_LABEL[provider]} secret key
            </Label>
            <Input
              id="pay-secret"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={
                hasSecret ? '•••••••• (leave blank to keep current)' : 'sk_live_…'
              }
              disabled={loading || saving}
              className="bg-muted font-mono text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Encrypted (AES-256-GCM) before it&apos;s stored, same as your
              WhatsApp token. We never show it again after saving.
            </p>
          </div>
        )}

        {provider === 'manual' && (
          <div className="space-y-2">
            <Label htmlFor="pay-manual" className="text-foreground">
              Payment instructions
            </Label>
            <Textarea
              id="pay-manual"
              value={manualInstructions}
              onChange={(e) => setManualInstructions(e.target.value)}
              placeholder={
                'Bank transfer: 0123456789 GTBank, Adaeze Stores.\nOr M-Pesa Till 567890. Send proof after paying.'
              }
              disabled={loading || saving}
              className="min-h-28 bg-muted text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Sent to the customer verbatim when a Request Payment step runs.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="pay-currency" className="text-foreground">
            Default currency
          </Label>
          <Input
            id="pay-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="NGN"
            disabled={loading || saving}
            className="w-32 bg-muted font-mono text-foreground"
          />
        </div>

        {feeBps > 0 && (
          <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Platform fee on collected payments:{' '}
            <span className="font-medium text-foreground">
              {(feeBps / 100).toFixed(2)}%
            </span>
            . You only ever pay it on money you actually receive.
          </p>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleAlert className="size-4" />
            Loading payment settings…
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
