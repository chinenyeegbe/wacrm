import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'

/**
 * Deliver a workspace invite over WhatsApp, from the workspace's own
 * connected number. Best-effort: callers always have the shareable join
 * link regardless, so a missing number or unapproved template degrades
 * to "copy the link" rather than failing the whole invite.
 *
 * The template is business-initiated, so it must be pre-approved in
 * Meta. Default name `workspace_invite`; override with
 * WHATSAPP_INVITE_TEMPLATE. Expected shape — a body with two text
 * params:
 *   {{1}} = workspace / agency name
 *   {{2}} = the join URL
 * e.g. "You've been invited to join {{1}}. Tap to accept: {{2}}"
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

export async function sendWhatsappInvite(args: {
  workspaceId: string
  toPhone: string
  workspaceName: string
  joinUrl: string
}): Promise<{ sent: true } | { sent: false; error: string }> {
  // Load the workspace's WhatsApp config via service role (the invite
  // route already authorized the caller as the workspace owner).
  const { data: config } = await admin()
    .from('whatsapp_config')
    .select('phone_number_id, access_token, status')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (!config) {
    return { sent: false, error: 'This workspace has no WhatsApp number connected yet' }
  }

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    return { sent: false, error: 'Stored WhatsApp token is corrupted — reconnect the number' }
  }

  const templateName = process.env.WHATSAPP_INVITE_TEMPLATE || 'workspace_invite'

  try {
    // sendTemplateMessage throws on a Meta error and returns { messageId }
    // on success — no success flag to check.
    await sendTemplateMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: args.toPhone,
      templateName,
      params: [args.workspaceName, args.joinUrl],
    })
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'WhatsApp send failed' }
  }
}
