'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { AIAutonomy } from '@/types';

const AUTONOMY_OPTIONS: {
  value: AIAutonomy;
  label: string;
  hint: string;
}[] = [
  {
    value: 'assist',
    label: 'Assist only',
    hint: 'AI just drafts replies for your team (the ✨ button). It never sends on its own.',
  },
  {
    value: 'human_loop',
    label: 'AI + human (recommended)',
    hint: 'AI auto-answers routine chats and hands flagged ones — hot leads, complaints — to a person.',
  },
  {
    value: 'autonomous',
    label: 'AI only',
    hint: 'AI handles everything itself, with no human routing. Best once you trust its replies.',
  },
];

// Keep the context bounded — it's prepended to every AI prompt, and free
// models have tight token windows. ~6k chars is plenty for a catalogue +
// prices + policies while staying cheap and fast.
const MAX_CONTEXT_CHARS = 6000;

const PLACEHOLDER = `Example:

We sell ankara fabrics and ready-made gowns in Lagos.
Prices: plain ankara ₦3,500/yard, premium ₦6,000/yard. Gowns from ₦15,000.
Delivery: Lagos ₦2,000 (1-2 days), nationwide ₦4,500 (3-5 days) via GIG.
Payment: bank transfer to 0123456789 GTBank, Adaeze Stores. We confirm before dispatch.
Hours: Mon-Sat 9am-7pm. We don't open Sundays.
Tone: warm, use a little Pidgin, always greet the customer by name.`;

export function AISettings() {
  const { user } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessContext, setBusinessContext] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autonomy, setAutonomy] = useState<AIAutonomy>('human_loop');
  // Snapshot of the saved values so we can compute a dirty flag.
  const [saved, setSaved] = useState({
    businessContext: '',
    aiEnabled: true,
    autonomy: 'human_loop' as AIAutonomy,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('business_context, ai_enabled, autonomy')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // A missing row is fine (first visit) — only surface real errors.
        console.error('Failed to load AI settings:', error);
      }
      const ctx = data?.business_context ?? '';
      const enabled = data?.ai_enabled ?? true;
      const auto = (data?.autonomy as AIAutonomy) ?? 'human_loop';
      setBusinessContext(ctx);
      setAiEnabled(enabled);
      setAutonomy(auto);
      setSaved({ businessContext: ctx, aiEnabled: enabled, autonomy: auto });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  const dirty =
    businessContext !== saved.businessContext ||
    aiEnabled !== saved.aiEnabled ||
    autonomy !== saved.autonomy;

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Upsert keyed on the unique user_id (migration 017). One row per
      // workspace; RLS confines it to the current user.
      const { error } = await supabase.from('ai_settings').upsert(
        {
          user_id: user.id,
          business_context: businessContext.trim() || null,
          ai_enabled: aiEnabled,
          autonomy,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw new Error(error.message);
      setSaved({ businessContext, aiEnabled, autonomy });
      toast.success('AI settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="size-4 text-fuchsia-400" />
          AI assistant
        </CardTitle>
        <CardDescription className="text-slate-400">
          Teach the AI about your business so its replies — in the inbox and in
          your <span className="font-medium">AI Reply</span> automations — quote
          real prices and stay on-brand. Runs on free models; never makes up
          facts you didn&apos;t give it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master switch */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div>
            <Label className="text-slate-200">Enable AI auto-replies</Label>
            <p className="mt-1 text-xs text-slate-500">
              When off, your <span className="font-medium">AI Reply</span>{' '}
              automation steps are skipped — a fast kill-switch without editing
              each automation. The inbox ✨ button still works on demand.
            </p>
          </div>
          <Switch
            checked={aiEnabled}
            onCheckedChange={(v) => setAiEnabled(!!v)}
            disabled={loading || saving}
            aria-label="Enable AI auto-replies"
          />
        </div>

        {/* Autonomy — how much the AI does on its own. Human-in-the-loop is
            the default, but each business picks the structure it trusts. */}
        <div className="space-y-2">
          <Label className="text-slate-200">How should the AI work?</Label>
          <p className="text-xs text-slate-500">
            Human-in-the-loop is optional — pick the structure that fits your
            team. You can change it anytime.
          </p>
          <div className="grid gap-2">
            {AUTONOMY_OPTIONS.map((opt) => {
              const selected = autonomy === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAutonomy(opt.value)}
                  disabled={loading || saving}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-full border',
                        selected
                          ? 'border-primary'
                          : 'border-slate-600',
                      )}
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        selected ? 'text-white' : 'text-slate-300',
                      )}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-slate-500">{opt.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Business context */}
        <div className="space-y-2">
          <Label htmlFor="ai-business-context" className="text-slate-200">
            Business context
          </Label>
          <p className="text-xs text-slate-500">
            Catalogue, prices, delivery, payment details, hours, and the tone
            you want. The more concrete, the better the replies.
          </p>
          <Textarea
            id="ai-business-context"
            value={businessContext}
            onChange={(e) =>
              setBusinessContext(e.target.value.slice(0, MAX_CONTEXT_CHARS))
            }
            placeholder={PLACEHOLDER}
            disabled={loading || saving}
            className="min-h-64 bg-slate-800 font-mono text-xs leading-relaxed text-white"
          />
          <div className="flex justify-end">
            <span className="text-[11px] text-slate-600">
              {businessContext.length} / {MAX_CONTEXT_CHARS}
            </span>
          </div>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <CircleAlert className="size-4" />
            Loading your AI settings…
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading || saving || !dirty}>
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
