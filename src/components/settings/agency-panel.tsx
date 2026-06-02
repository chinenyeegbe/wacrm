'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Users,
  Pencil,
  Trash2,
  Check,
  X,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface Workspace {
  id: string;
  name: string;
}

interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

export function AgencyPanel() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/workspaces');
      const data = await res.json();
      if (res.ok) setWorkspaces(data.workspaces ?? []);
    } catch {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  async function createWorkspace() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/agency/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create workspace');
        return;
      }
      setNewName('');
      toast.success(`Created "${name}"`);
      await loadWorkspaces();
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading workspaces…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Workspaces &amp; team</h2>
        <p className="mt-1 text-sm text-slate-400">
          Each workspace is an isolated client — its own contacts, inbox,
          pipelines, and WhatsApp number. Invite teammates to the workspaces
          they should handle.
        </p>
      </div>

      {/* Create */}
      <Card className="border-slate-700 bg-slate-900">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-workspace" className="text-slate-300">
              New workspace
            </Label>
            <Input
              id="new-workspace"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createWorkspace();
              }}
              placeholder="e.g. Acme Corp"
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
            />
          </div>
          <Button onClick={createWorkspace} disabled={creating || !newName.trim()}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {workspaces.map((w) => (
          <WorkspaceRow
            key={w.id}
            workspace={w}
            expanded={expanded === w.id}
            onToggle={() =>
              setExpanded((cur) => (cur === w.id ? null : w.id))
            }
            onRenamed={loadWorkspaces}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceRow({
  workspace,
  expanded,
  onToggle,
  onRenamed,
}: {
  workspace: Workspace;
  expanded: boolean;
  onToggle: () => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);

  async function rename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) {
      setEditing(false);
      setName(workspace.name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/agency/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspace.id, name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Rename failed');
        return;
      }
      toast.success('Renamed');
      setEditing(false);
      onRenamed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-slate-700 bg-slate-900">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>

          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename();
                  if (e.key === 'Escape') {
                    setEditing(false);
                    setName(workspace.name);
                  }
                }}
                autoFocus
                className="h-8 border-slate-700 bg-slate-800 text-white"
              />
              <Button size="sm" onClick={rename} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(workspace.name);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <span className="flex-1 truncate text-sm font-medium text-white">
                {workspace.name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="text-slate-400 hover:text-white"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggle}
                className="text-slate-400 hover:text-white"
              >
                <Users className="h-4 w-4" />
                Members
              </Button>
            </>
          )}
        </div>

        {expanded && !editing ? (
          <MemberManager workspaceId={workspace.id} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function MemberManager({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/agency/members?workspace_id=${encodeURIComponent(workspaceId)}`
      );
      const data = await res.json();
      if (res.ok) setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const value = email.trim();
    if (!value) return;
    setAdding(true);
    try {
      const res = await fetch('/api/agency/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, email: value, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add member');
        return;
      }
      setEmail('');
      toast.success('Member added');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(userId: string) {
    const res = await fetch('/api/agency/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to remove member');
      return;
    }
    toast.success('Member removed');
    await load();
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
      {/* Add member */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="teammate@example.com"
          type="email"
          className="flex-1 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
          className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-white"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button size="sm" onClick={add} disabled={adding || !email.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
        </div>
      ) : members.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">
          No members yet — only you (the agency owner) can access this
          workspace.
        </p>
      ) : (
        <ul className="space-y-1">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-800/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  {m.full_name || m.email || m.user_id}
                </p>
                {m.full_name && m.email ? (
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                ) : null}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {m.role}
              </span>
              {m.role !== 'owner' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(m.user_id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
