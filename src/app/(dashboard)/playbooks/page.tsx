'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Repeat, Trash2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SMART_AUDIENCES, type SmartAudienceType } from '@/lib/broadcasts/audience';
import type { MessageTemplate } from '@/types';

interface Playbook {
  id: string;
  name: string;
  audience_type: SmartAudienceType;
  window_days: number;
  cooldown_days: number;
  template_name: string;
  template_language: string;
  enabled: boolean;
  last_run_at: string | null;
}

const AUDIENCE_LABEL: Record<SmartAudienceType, string> = Object.fromEntries(
  SMART_AUDIENCES.map((a) => [a.type, a.label]),
) as Record<SmartAudienceType, string>;

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const db = createClient();
    return Promise.all([
      db.from('playbooks').select('*').order('created_at', { ascending: false }),
      db
        .from('message_templates')
        .select('*')
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: pbs }, { data: tpls }]) => {
      setPlaybooks((pbs ?? []) as Playbook[]);
      setTemplates((tpls ?? []) as MessageTemplate[]);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(pb: Playbook) {
    setBusyId(pb.id);
    const db = createClient();
    const { error } = await db
      .from('playbooks')
      .update({ enabled: !pb.enabled, updated_at: new Date().toISOString() })
      .eq('id', pb.id);
    if (error) toast.error(error.message);
    else await load();
    setBusyId(null);
  }

  async function remove(pb: Playbook) {
    if (!confirm(`Delete playbook “${pb.name}”?`)) return;
    setBusyId(pb.id);
    const db = createClient();
    const { error } = await db.from('playbooks').delete().eq('id', pb.id);
    if (error) toast.error(error.message);
    else await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Playbooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatic campaigns that bring existing customers back — they
            run daily, target the right customers, and skip anyone messaged
            recently.
          </p>
        </div>
        {!creating && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New playbook
          </Button>
        )}
      </div>

      {creating && (
        <CreatePlaybookForm
          templates={templates}
          onCancel={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}

      {playbooks === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : playbooks.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Repeat className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No playbooks yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to automatically reactivate dormant customers, chase
            due services, or ask for reviews.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {playbooks.map((pb) => (
            <li
              key={pb.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {pb.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {AUDIENCE_LABEL[pb.audience_type]} · window {pb.window_days}d ·
                  cooldown {pb.cooldown_days}d · template “{pb.template_name}”
                  {pb.last_run_at
                    ? ` · last ran ${new Date(pb.last_run_at).toLocaleDateString()}`
                    : ' · never run'}
                </p>
              </div>
              <button
                onClick={() => toggle(pb)}
                disabled={busyId === pb.id}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  pb.enabled
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                {pb.enabled ? 'Active' : 'Paused'}
              </button>
              <button
                aria-label="Delete playbook"
                onClick={() => remove(pb)}
                disabled={busyId === pb.id}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreatePlaybookForm({
  templates,
  onCancel,
  onCreated,
}: {
  templates: MessageTemplate[];
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [audienceType, setAudienceType] = useState<SmartAudienceType>('dormant');
  const [templateName, setTemplateName] = useState('');
  const [windowDays, setWindowDays] = useState(180);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [saving, setSaving] = useState(false);

  const chosenTemplate = useMemo(
    () => templates.find((t) => t.name === templateName),
    [templates, templateName],
  );

  async function save() {
    if (!name.trim() || !templateName) {
      toast.error('Give the playbook a name and pick a template.');
      return;
    }
    setSaving(true);
    const db = createClient();
    const {
      data: { session },
    } = await db.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not signed in.');
      setSaving(false);
      return;
    }
    const { error } = await db.from('playbooks').insert({
      user_id: user.id,
      name: name.trim(),
      audience_type: audienceType,
      window_days: windowDays,
      cooldown_days: cooldownDays,
      template_name: templateName,
      template_language: chosenTemplate?.language ?? 'en_US',
      enabled: false,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Playbook created — turn it on when you’re ready.');
    await onCreated();
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-foreground">New playbook</p>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Win back dormant customers"
          className="border-border bg-secondary text-foreground"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Who to message
          </label>
          <select
            value={audienceType}
            onChange={(e) => {
              const next = e.target.value as SmartAudienceType;
              setAudienceType(next);
              // Reset the window to the new audience's suggested value —
              // done here (not via an effect keyed on audienceType) so
              // both updates land in the same render, per React's
              // guidance on adjusting state from an event vs an effect.
              const def = SMART_AUDIENCES.find((a) => a.type === next);
              if (def) setWindowDays(def.defaultWindowDays);
            }}
            className="h-9 w-full rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
          >
            {SMART_AUDIENCES.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Template
          </label>
          <select
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Select an approved template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No approved templates. Create and get one approved in Settings.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {SMART_AUDIENCES.find((a) => a.type === audienceType)?.windowLabel}
          </label>
          <Input
            type="number"
            min={1}
            value={windowDays}
            onChange={(e) => setWindowDays(Math.max(1, Number(e.target.value) || 1))}
            className="border-border bg-secondary text-foreground"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Don’t re-message within (days)
          </label>
          <Input
            type="number"
            min={0}
            value={cooldownDays}
            onChange={(e) => setCooldownDays(Math.max(0, Number(e.target.value) || 0))}
            className="border-border bg-secondary text-foreground"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="border-border text-foreground"
        >
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create playbook'}
        </Button>
      </div>
    </div>
  );
}
