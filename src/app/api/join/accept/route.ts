import { NextResponse } from 'next/server'
import { createClient, ACTIVE_WORKSPACE_COOKIE } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/workspace/invites'

/**
 * POST /api/join/accept  { token }
 * Redeem an invite for the signed-in user, then make the joined
 * workspace active so they land straight in it.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const result = await acceptInvite(token, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true, workspace_id: result.workspaceId })
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, result.workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
