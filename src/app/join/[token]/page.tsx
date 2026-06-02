import { createClient as createAdmin } from '@supabase/supabase-js'
import { MessageSquare } from 'lucide-react'
import { JoinClient } from './join-client'

/**
 * Public invite landing page: /join/<token>. Looks the invite up by its
 * secret token (service role — the visitor may not be a member yet),
 * resolves the workspace name, and hands off to the client component
 * which handles the authed/unauthed branches.
 */

interface ResolvedInvite {
  valid: boolean
  reason?: string
  workspaceName?: string
}

async function resolveInvite(token: string): Promise<ResolvedInvite> {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: invite } = await admin
    .from('workspace_invites')
    .select('workspace_id, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return { valid: false, reason: 'This invite link is not valid.' }
  if (invite.status !== 'pending') {
    return { valid: false, reason: 'This invite has already been used or revoked.' }
  }
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return { valid: false, reason: 'This invite has expired.' }
  }

  const { data: ws } = await admin
    .from('workspaces')
    .select('name')
    .eq('id', invite.workspace_id as string)
    .maybeSingle()

  return { valid: true, workspaceName: (ws?.name as string) ?? 'a workspace' }
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await resolveInvite(token)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          {invite.valid ? (
            <>
              <h1 className="text-xl font-semibold text-white">
                You&apos;ve been invited
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Join <span className="font-medium text-slate-200">{invite.workspaceName}</span> on
                wacrm.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white">Invite unavailable</h1>
              <p className="mt-1 text-sm text-slate-400">{invite.reason}</p>
            </>
          )}
        </div>

        {invite.valid ? <JoinClient token={token} /> : null}
      </div>
    </div>
  )
}
