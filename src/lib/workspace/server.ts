import { createClient } from '@/lib/supabase/server'

/**
 * Agency-mode workspace helpers (server-only).
 *
 * Tenancy shape (migration 017): agency -> workspaces -> members. A user
 * can access a workspace if they are a member of it OR own the agency it
 * belongs to. RLS enforces this; these helpers just read what's visible.
 */

export interface Workspace {
  id: string
  name: string
  agency_id: string
  agency_name: string | null
  /** True when the current user owns the agency this workspace is under. */
  is_agency_owner: boolean
}

/**
 * Every workspace the signed-in user can access, oldest first. Returns
 * `[]` when signed out. RLS scopes the result, so this is safe to call
 * without passing the user id.
 */
export async function getAccessibleWorkspaces(): Promise<Workspace[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, agency_id, agencies(name, owner_user_id)')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((w) => {
    // Supabase types the embedded relation as array | object depending
    // on the FK shape; normalise both.
    const agency = Array.isArray(w.agencies) ? w.agencies[0] : w.agencies
    return {
      id: w.id as string,
      name: w.name as string,
      agency_id: w.agency_id as string,
      agency_name: (agency?.name as string | undefined) ?? null,
      is_agency_owner: agency?.owner_user_id === user.id,
    }
  })
}

/**
 * The user's currently-active workspace id, or null if they have none
 * accessible. Validates the `wacrm_active_workspace` cookie against the
 * set the user can actually access (a stale/forged cookie falls back to
 * the first accessible workspace), so the returned id is always one the
 * caller is allowed to use.
 */
export async function getActiveWorkspace(): Promise<Workspace | null> {
  const { cookies } = await import('next/headers')
  const { ACTIVE_WORKSPACE_COOKIE } = await import('@/lib/supabase/server')

  const accessible = await getAccessibleWorkspaces()
  if (accessible.length === 0) return null

  const cookieStore = await cookies()
  const cookieId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  const fromCookie = cookieId
    ? accessible.find((w) => w.id === cookieId)
    : undefined

  return fromCookie ?? accessible[0]
}

/**
 * Whether the user can access a given workspace — used to validate a
 * requested switch before writing the cookie.
 */
export async function canAccessWorkspace(workspaceId: string): Promise<boolean> {
  const accessible = await getAccessibleWorkspaces()
  return accessible.some((w) => w.id === workspaceId)
}

export interface OwnedAgency {
  id: string
  name: string
}

/**
 * The agency the signed-in user owns (every user bootstraps exactly one
 * in migration 017), or null if signed out / not found. Agency
 * management — creating client workspaces, inviting members — is gated
 * on owning an agency.
 */
export async function getOwnedAgency(): Promise<OwnedAgency | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('agencies')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id as string, name: data.name as string }
}

/** True when the user owns the agency that the given workspace is under. */
export async function ownsWorkspace(workspaceId: string): Promise<boolean> {
  const ws = await getAccessibleWorkspaces()
  const target = ws.find((w) => w.id === workspaceId)
  return !!target?.is_agency_owner
}
