import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role helpers for agency member management (server-only).
 *
 * Why service role is needed: profiles RLS is `auth.uid() = user_id`, so
 * an agency owner cannot look up a teammate by email through their own
 * session, and cannot read co-members' names/emails for display. Every
 * function here MUST be called only after the route has verified the
 * caller owns the agency the workspace belongs to — the service role
 * bypasses RLS, so authorization is the caller's responsibility.
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

export interface WorkspaceMember {
  user_id: string
  email: string | null
  full_name: string | null
  role: string
}

/** List members of a workspace, enriched with profile name/email. */
export async function listMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const { data: members, error } = await admin()
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error || !members) return []

  const ids = members.map((m) => m.user_id as string)
  const { data: profiles } = await admin()
    .from('profiles')
    .select('user_id, email, full_name')
    .in('user_id', ids)

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.user_id as string,
      { email: p.email as string | null, full_name: p.full_name as string | null },
    ])
  )

  return members.map((m) => ({
    user_id: m.user_id as string,
    role: m.role as string,
    email: byId.get(m.user_id as string)?.email ?? null,
    full_name: byId.get(m.user_id as string)?.full_name ?? null,
  }))
}

/** Resolve a user id from an email, or null if no such account exists. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin()
    .from('profiles')
    .select('user_id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

/**
 * Add a member to a workspace. Idempotent on (workspace_id, user_id) —
 * an existing membership has its role updated instead of erroring.
 */
export async function addMember(
  workspaceId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin()
    .from('workspace_members')
    .upsert(
      { workspace_id: workspaceId, user_id: userId, role },
      { onConflict: 'workspace_id,user_id' }
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Remove a member from a workspace. */
export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin()
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
