import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role helpers for workspace invites (server-only).
 *
 * Like lib/workspace/admin.ts, these bypass RLS, so every caller MUST
 * have verified authorization first:
 *   - create / list / revoke: caller owns the workspace.
 *   - accept: caller is the authenticated user redeeming their own token.
 */

let _admin: SupabaseClient | null = null
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

export interface Invite {
  id: string
  workspace_id: string
  token: string
  phone: string | null
  role: string
  status: string
  created_at: string
  expires_at: string
}

/** Create a pending invite and return it (token included). */
export async function createInvite(args: {
  workspaceId: string
  createdBy: string
  role: 'admin' | 'member'
  phone?: string | null
}): Promise<Invite | null> {
  const token = randomBytes(24).toString('base64url')
  const { data, error } = await admin()
    .from('workspace_invites')
    .insert({
      workspace_id: args.workspaceId,
      token,
      role: args.role,
      phone: args.phone ?? null,
      created_by: args.createdBy,
    })
    .select('id, workspace_id, token, phone, role, status, created_at, expires_at')
    .single()
  if (error || !data) return null
  return data as Invite
}

/** Pending invites for a workspace, newest first. */
export async function listPendingInvites(workspaceId: string): Promise<Invite[]> {
  const { data, error } = await admin()
    .from('workspace_invites')
    .select('id, workspace_id, token, phone, role, status, created_at, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as Invite[]
}

/** Look up an invite by its secret token (any status). */
export async function getInviteByToken(token: string): Promise<Invite | null> {
  const { data } = await admin()
    .from('workspace_invites')
    .select('id, workspace_id, token, phone, role, status, created_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  return (data as Invite | null) ?? null
}

/** Revoke a pending invite. Caller must own the workspace. */
export async function revokeInvite(id: string): Promise<boolean> {
  const { error } = await admin()
    .from('workspace_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('status', 'pending')
  return !error
}

/**
 * Redeem a token for the authenticated user: validates the invite is
 * pending and unexpired, adds membership, and marks the invite accepted.
 * Returns the workspace id on success.
 */
export async function acceptInvite(
  token: string,
  userId: string
): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  const invite = await getInviteByToken(token)
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (invite.status !== 'pending') {
    return { ok: false, error: 'This invite has already been used or revoked' }
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'This invite has expired' }
  }

  const { error: memberErr } = await admin()
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: userId, role: invite.role },
      { onConflict: 'workspace_id,user_id' }
    )
  if (memberErr) return { ok: false, error: memberErr.message }

  await admin()
    .from('workspace_invites')
    .update({
      status: 'accepted',
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  return { ok: true, workspaceId: invite.workspace_id }
}
