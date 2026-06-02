import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ownsWorkspace } from '@/lib/workspace/server'
import {
  listMembers,
  findUserIdByEmail,
  addMember,
  removeMember,
} from '@/lib/workspace/admin'

/**
 * Member management for a workspace. Every method re-verifies that the
 * caller owns the workspace before touching the service-role helpers,
 * which bypass RLS.
 */

async function requireOwner(workspaceId: string | undefined) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  if (!workspaceId) return { error: 'workspace_id required', status: 400 as const }
  if (!(await ownsWorkspace(workspaceId))) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { user }
}

/** GET /api/agency/members?workspace_id=... */
export async function GET(request: Request) {
  const workspaceId =
    new URL(request.url).searchParams.get('workspace_id') ?? undefined
  const auth = await requireOwner(workspaceId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const members = await listMembers(workspaceId!)
  return NextResponse.json({ members })
}

/** POST /api/agency/members  { workspace_id, email, role } */
export async function POST(request: Request) {
  let body: { workspace_id?: string; email?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const auth = await requireOwner(body.workspace_id)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const email = body.email?.trim()
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  const role = body.role === 'admin' ? 'admin' : 'member'

  const userId = await findUserIdByEmail(email)
  if (!userId) {
    return NextResponse.json(
      {
        error:
          'No wacrm account uses that email. Ask them to sign up first, then add them.',
      },
      { status: 404 }
    )
  }

  const result = await addMember(body.workspace_id!, userId, role)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** DELETE /api/agency/members  { workspace_id, user_id } */
export async function DELETE(request: Request) {
  let body: { workspace_id?: string; user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const auth = await requireOwner(body.workspace_id)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const result = await removeMember(body.workspace_id!, body.user_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
