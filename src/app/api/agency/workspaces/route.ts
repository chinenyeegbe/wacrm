import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAccessibleWorkspaces,
  getOwnedAgency,
  ownsWorkspace,
} from '@/lib/workspace/server'

/**
 * GET /api/agency/workspaces
 * The client workspaces the signed-in user owns (i.e. under their agency).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = await getAccessibleWorkspaces()
  const owned = all.filter((w) => w.is_agency_owner)
  return NextResponse.json({ workspaces: owned })
}

/**
 * POST /api/agency/workspaces  { name }
 * Create a new client workspace under the caller's agency. RLS's
 * "Agency owners manage workspaces" WITH CHECK independently enforces
 * that agency_id belongs to the caller.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agency = await getOwnedAgency()
  if (!agency) {
    return NextResponse.json({ error: 'No agency found' }, { status: 403 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ agency_id: agency.id, name })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace: data })
}

/**
 * PATCH /api/agency/workspaces  { id, name }
 * Rename a workspace the caller owns.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const id = body.id?.trim()
  const name = body.name?.trim()
  if (!id || !name) {
    return NextResponse.json({ error: 'id and name required' }, { status: 400 })
  }

  if (!(await ownsWorkspace(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', id)
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace: data })
}
