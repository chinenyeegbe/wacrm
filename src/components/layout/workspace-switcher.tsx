"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Workspace {
  id: string;
  name: string;
  agency_name: string | null;
  is_agency_owner: boolean;
}

/**
 * Agency-mode workspace switcher. Lives under the sidebar logo.
 *
 * - 0 workspaces: renders nothing (shouldn't happen post-migration-017,
 *   but fails quiet rather than showing a broken control).
 * - 1 workspace: a static label — no dropdown, since there's nothing to
 *   switch to. Keeps single-business installs uncluttered.
 * - 2+ workspaces: a dropdown that POSTs the choice and refreshes so the
 *   server components re-render scoped to the new workspace (the active
 *   id rides in a cookie -> x-workspace-id header -> RLS).
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : { workspaces: [], active_id: null }))
      .then((data) => {
        if (cancelled) return;
        setWorkspaces(data.workspaces ?? []);
        setActiveId(data.active_id ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-10 items-center gap-2 px-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading workspace…</span>
      </div>
    );
  }

  if (workspaces.length === 0) return null;

  const active =
    workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  // Single workspace — static label, nothing to switch between.
  if (workspaces.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-left">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">
            {active.name}
          </p>
          {active.agency_name ? (
            <p className="truncate text-xs text-slate-500">
              {active.agency_name}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  async function switchTo(id: string) {
    if (id === active.id) return;
    setSwitching(id);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: id }),
      });
      if (res.ok) {
        setActiveId(id);
        // Re-render server components with the new active-workspace cookie.
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-200">
            {active.name}
          </p>
          {active.agency_name ? (
            <p className="truncate text-xs text-slate-500">
              {active.agency_name}
            </p>
          ) : null}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => switchTo(w.id)}
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{w.name}</p>
              {w.agency_name ? (
                <p className="truncate text-xs text-slate-500">
                  {w.agency_name}
                </p>
              ) : null}
            </div>
            {switching === w.id ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
            ) : w.id === active.id ? (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
