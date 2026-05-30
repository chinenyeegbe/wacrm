/**
 * Workspace roles & capabilities — the permission model for agency mode.
 *
 * A workspace is one business. People join a workspace with a role. This
 * module is the single source of truth for "what can each role do",
 * expressed as pure data + pure functions so it is trivially testable and
 * can be reused on both the server (authorization) and client (hiding UI).
 *
 * It deliberately knows nothing about the database or RLS — those enforce
 * the boundary; this defines the policy.
 *
 * Roles (least → most power):
 *   - viewer    : read-only. Sees inbox/contacts/analytics, sends nothing.
 *   - agent     : front-line. Replies in the inbox, manages contacts/deals.
 *                 The "young African operator" doing the day-to-day work.
 *   - operator  : agent + can configure AI, automations, broadcasts, and
 *                 see earnings. Runs the workspace day-to-day for the owner.
 *   - owner     : everything, including payments, billing, members, and
 *                 deleting the workspace. The business itself.
 */

export type WorkspaceRole = "viewer" | "agent" | "operator" | "owner";

/** Every distinct thing a member might be allowed to do. */
export type Capability =
  | "inbox.view"
  | "inbox.reply"
  | "contacts.manage"
  | "deals.manage"
  | "broadcasts.send"
  | "automations.manage"
  | "ai.configure"
  | "payments.configure"
  | "payments.request" // raise a payment link in a chat
  | "earnings.view"
  | "members.manage"
  | "workspace.settings"
  | "workspace.delete";

// Ordered for hierarchy comparisons (e.g. "at least an agent").
const ROLE_ORDER: WorkspaceRole[] = ["viewer", "agent", "operator", "owner"];

/**
 * Capabilities granted DIRECTLY at each level. Higher roles inherit all
 * capabilities of the levels below them (see `capabilitiesFor`), so each
 * entry lists only what that level ADDS.
 */
const DIRECT_CAPABILITIES: Record<WorkspaceRole, Capability[]> = {
  viewer: ["inbox.view"],
  agent: [
    "inbox.reply",
    "contacts.manage",
    "deals.manage",
    "payments.request",
  ],
  operator: [
    "broadcasts.send",
    "automations.manage",
    "ai.configure",
    "earnings.view",
  ],
  owner: [
    "payments.configure",
    "members.manage",
    "workspace.settings",
    "workspace.delete",
  ],
};

/** Rank of a role in the hierarchy (higher = more power). */
export function roleRank(role: WorkspaceRole): number {
  return ROLE_ORDER.indexOf(role);
}

/** True when `role` is at least as powerful as `min`. */
export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** The full (inherited) capability set for a role. */
export function capabilitiesFor(role: WorkspaceRole): Set<Capability> {
  const caps = new Set<Capability>();
  for (const r of ROLE_ORDER) {
    for (const c of DIRECT_CAPABILITIES[r]) caps.add(c);
    if (r === role) break; // stop once we've folded in our own level
  }
  return caps;
}

/** Does this role have the given capability? */
export function can(role: WorkspaceRole, capability: Capability): boolean {
  return capabilitiesFor(role).has(capability);
}

/** Validate an arbitrary string as a role (defensive at API boundaries). */
export function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return typeof v === "string" && (ROLE_ORDER as string[]).includes(v);
}

/**
 * Can `actor` assign `target` role to someone? You may only grant a role
 * strictly below your own (owners can make operators/agents/viewers; an
 * operator cannot mint another operator or owner). Prevents privilege
 * escalation through the members UI.
 */
export function canAssignRole(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): boolean {
  if (!can(actor, "members.manage")) return false;
  return roleRank(target) < roleRank(actor);
}
