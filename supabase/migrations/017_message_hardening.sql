-- ============================================================
-- 017_message_hardening.sql
--
-- Two independent hardening changes to the `messages` table:
--
--   1. Fix a tenant write-isolation hole. Migration 001 created
--      `CREATE POLICY "Service role can insert messages" ON messages
--       FOR INSERT WITH CHECK (true);` — but the policy has no TO
--      clause, so it applies to the `authenticated` (anon-key) role,
--      and `WITH CHECK (true)` always passes. Because permissive
--      policies are OR'd, ANY signed-in user could INSERT a message
--      row into ANY conversation, including one they don't own
--      (reads were already correctly scoped, writes were not).
--
--      The policy was never actually needed: the webhook, automation,
--      and flow senders all write via the service-role client, which
--      bypasses RLS entirely. The only authenticated-client insert is
--      the agent send route (src/app/api/whatsapp/send/route.ts), and
--      it always targets a conversation the user owns — already
--      covered by the "Users can view own messages" FOR ALL policy
--      (its USING clause doubles as the WITH CHECK for INSERT). We
--      replace the broken policy with an explicit, correctly-scoped
--      INSERT policy so the intent is clear and stays correct even if
--      the FOR ALL policy is ever narrowed to FOR SELECT.
--
--   2. Make inbound message ingestion idempotent. Meta re-delivers
--      webhooks on any non-2xx (and occasionally after a 2xx too), and
--      the inbound insert (webhook route.ts) had no dedup guard, so a
--      re-delivery created a duplicate message row. We add a partial
--      composite UNIQUE index on (conversation_id, message_id) so a
--      re-delivered Meta wamid is rejected at the DB; the webhook code
--      treats the resulting unique-violation as an already-processed
--      no-op. Scoped to (conversation_id, message_id) — matching how
--      the existing status-update lookups scope by conversation — and
--      partial (WHERE message_id IS NOT NULL) because pre-send rows in
--      'sending'/'failed' status legitimately have a NULL message_id.
--
-- MIGRATION REQUIRED: apply this file (Supabase SQL editor or
-- `supabase db push`) before deploying the matching app version.
-- ============================================================

-- 1. Replace the permissive INSERT policy with a scoped one.
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages into own conversations" ON messages;
CREATE POLICY "Users can insert messages into own conversations" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- 2. De-duplicate any existing rows before adding the unique index
--    (index creation fails if duplicates already exist). Keep the
--    earliest physical row per (conversation_id, message_id).
DELETE FROM messages a
USING messages b
WHERE a.message_id IS NOT NULL
  AND a.message_id = b.message_id
  AND a.conversation_id = b.conversation_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_conversation_message_id
  ON messages (conversation_id, message_id)
  WHERE message_id IS NOT NULL;
