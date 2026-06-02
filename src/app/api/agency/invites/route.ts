import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { ownsWorkspace, getAccessibleWorkspaces } from '@/lib/workspace/server'
import {
  createInvite,
  listPendingInvites,
  revokeInvite,
} from '@/lib/workspace/invites'
import { sendWhatsappInvite } from '@/lib/whatsapp/invite-send'

function joinUrl(request: Request, token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(request.url).origin
  return `${base}/join/${token}`
}

/** GET /api/agency/invites?workspace_id=... — pending invites. */
export async function GET(request: Request) {
  const workspaceId =
    new URL(request.url).searchParams.get('workspace_id') ?? undefined
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!workspaceId || !(await ownsWorkspace(workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invites = await listPendingInvites(workspaceId)
  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      phone: i.phone,
      role: i.role,
      created_at: i.created_at,
      expires_at: i.expires_at,
      join_url: joinUrl(request, i.token),
    })),
  })
}

/**
 * POST /api/agency/invites  { workspace_id, role?, phone? }
 * Creates an invite (always returns a join link) and, when a phone is
 * given, attempts WhatsApp delivery from the workspace's number.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspace_id?: string; role?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const workspaceId = body.workspace_id?.trim()
  if (!workspaceId || !(await ownsWorkspace(workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const role = body.role === 'admin' ? 'admin' : 'member'
  const phone = body.phone?.trim() || null

  const invite = await createInvite({
    workspaceId,
    createdBy: user.id,
    role,
    phone,
  })
  if (!invite) {
    return NextResponse.json({ error: 'Could not create invite' }, { status: 500 })
  }

  const link = joinUrl(request, invite.token)

  let whatsapp_sent = false
  let whatsapp_error: string | undefined
  if (phone) {
    const ws = (await getAccessibleWorkspaces()).find((w) => w.id === workspaceId)
    const result = await sendWhatsappInvite({
      workspaceId,
      toPhone: phone,
      workspaceName: ws?.name ?? 'your workspace',
      joinUrl: link,
    })
    whatsapp_sent = result.sent
    if (!result.sent) whatsapp_error = result.error
  }

  return NextResponse.json({
    invite: { id: invite.id, phone: invite.phone, role: invite.role },
    join_url: link,
    whatsapp_sent,
    whatsapp_error,
  })
}

/** DELETE /api/agency/invites  { id } — revoke a pending invite. */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // The invite helpers bypass RLS, so confirm the caller owns the
  // invite's workspace before revoking. Look the invite up by id via the
  // service role, then check ownership against the user's session.
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: row } = await admin
    .from('workspace_invites')
    .select('workspace_id')
    .eq('id', body.id)
    .maybeSingle()
  if (!row || !(await ownsWorkspace(row.workspace_id as string))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ok = await revokeInvite(body.id)
  if (!ok) return NextResponse.json({ error: 'Revoke failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
