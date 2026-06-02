import { NextResponse } from 'next/server'
import { createClient, ACTIVE_WORKSPACE_COOKIE } from '@/lib/supabase/server'
import {
  getAccessibleWorkspaces,
  getActiveWorkspace,
  canAccessWorkspace,
} from '@/lib/workspace/server'

/**
 * GET /api/workspace
 *
 * Lists the workspaces the signed-in user can access plus the active id
 * from the cookie. Used by the sidebar workspace switcher on mount.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [workspaces, active] = await Promise.all([
    getAccessibleWorkspaces(),
    getActiveWorkspace(),
  ])
  return NextResponse.json({ workspaces, active_id: active?.id ?? null })
}

/**
 * POST /api/workspace  { workspace_id }
 *
 * Switches the active workspace. We validate membership server-side
 * before writing the cookie so a user can never pin the app to a
 * workspace they don't belong to — RLS would block the data anyway, but
 * failing here gives a clean error instead of an empty app.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { workspace_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const workspaceId = body.workspace_id?.trim()
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  if (!(await canAccessWorkspace(workspaceId))) {
    return NextResponse.json(
      { error: 'You do not have access to that workspace' },
      { status: 403 }
    )
  }

  const res = NextResponse.json({ ok: true, workspace_id: workspaceId })
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return res
}
