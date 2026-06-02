-- ============================================================
-- 022_agency_rls_cutover.sql, Agency mode part 2: let workspace
-- members access the owner's data.
--
-- !!! REVIEW + DATABASE-TEST REQUIRED BEFORE YOU TRUST THIS !!!
-- A mistake in these policies could let one business read another's
-- WhatsApp chats. Do NOT consider this done until you have run the
-- two-account leak test in docs/agency-rls-test-plan.md against a real
-- Supabase project. It is safe to leave UNAPPLIED until then.
--
-- What it does, and why it is safe-by-construction:
--   * Adds one helper, can_access_user_data(owner), true when the caller
--     IS the owner OR is a member of that owner's personal workspace
--     (migration 019). For a normal single user with no members, it
--     reduces to `owner = auth.uid()`, i.e. today's behaviour exactly.
--   * Adds NEW permissive policies named "Members ..." ALONGSIDE the
--     existing "Users can ..." owner policies. Postgres ORs permissive
--     policies, and the existing ones already cover the owner, so this is
--     purely additive: it grants members access, never removes anyone's.
--
-- Scope note (v1): a member gets the SAME access the owner has (read +
-- write). Role-based limits (a 'viewer' should not write) are a later
-- refinement; today operators are trusted. The role column already exists
-- on workspace_members for when we tighten this.
--
-- Idempotent. Conventions from 001_initial_schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- The one helper every policy below calls.
-- SECURITY DEFINER so it can read workspace_members without recursing into
-- that table's own RLS during policy evaluation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_user_data(p_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_owner = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE w.owner_id = p_owner
        AND m.user_id = auth.uid()
    );
$$;

ALTER FUNCTION public.can_access_user_data(UUID) OWNER TO postgres;

-- ------------------------------------------------------------
-- Tables owned directly via a user_id column.
-- For each: a permissive FOR ALL policy gated on can_access_user_data.
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  direct_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs',
    'ai_settings', 'payment_config'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Members can access ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.can_access_user_data(user_id)) WITH CHECK (public.can_access_user_data(user_id))',
      'Members can access ' || t, t
    );
  END LOOP;
END $$;

-- payment_requests: members may READ the business's payments (writes stay
-- server-side via the service role, so SELECT only).
DROP POLICY IF EXISTS "Members can view payment requests" ON payment_requests;
CREATE POLICY "Members can view payment requests" ON payment_requests FOR SELECT
  USING (public.can_access_user_data(user_id));

-- ------------------------------------------------------------
-- Child tables owned via a parent row. Gate through the parent's owner.
-- ------------------------------------------------------------

-- contact_tags -> contacts
DROP POLICY IF EXISTS "Members can access contact_tags" ON contact_tags;
CREATE POLICY "Members can access contact_tags" ON contact_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND public.can_access_user_data(c.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND public.can_access_user_data(c.user_id)));

-- contact_custom_values -> contacts
DROP POLICY IF EXISTS "Members can access contact_custom_values" ON contact_custom_values;
CREATE POLICY "Members can access contact_custom_values" ON contact_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND public.can_access_user_data(c.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND public.can_access_user_data(c.user_id)));

-- messages -> conversations
DROP POLICY IF EXISTS "Members can access messages" ON messages;
CREATE POLICY "Members can access messages" ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND public.can_access_user_data(c.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND public.can_access_user_data(c.user_id)));

-- pipeline_stages -> pipelines
DROP POLICY IF EXISTS "Members can access pipeline_stages" ON pipeline_stages;
CREATE POLICY "Members can access pipeline_stages" ON pipeline_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND public.can_access_user_data(p.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND public.can_access_user_data(p.user_id)));

-- broadcast_recipients -> broadcasts
DROP POLICY IF EXISTS "Members can access broadcast_recipients" ON broadcast_recipients;
CREATE POLICY "Members can access broadcast_recipients" ON broadcast_recipients FOR ALL
  USING (EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND public.can_access_user_data(b.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND public.can_access_user_data(b.user_id)));

-- automation_steps -> automations
DROP POLICY IF EXISTS "Members can access automation_steps" ON automation_steps;
CREATE POLICY "Members can access automation_steps" ON automation_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND public.can_access_user_data(a.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND public.can_access_user_data(a.user_id)));

-- message_reactions -> conversations (reactions carry conversation_id)
DROP POLICY IF EXISTS "Members can access message_reactions" ON message_reactions;
CREATE POLICY "Members can access message_reactions" ON message_reactions FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = message_reactions.conversation_id AND public.can_access_user_data(c.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = message_reactions.conversation_id AND public.can_access_user_data(c.user_id)));

-- ------------------------------------------------------------
-- NOT touched on purpose:
--   * partners / referrals / referral_earnings / partner_payouts, a
--     partner's earnings are personal, not shared with the workspaces they
--     operate. They stay own-only.
--   * flows / flow_nodes / flow_runs (upstream), confirm their exact
--     ownership columns before adding member policies in a follow-up.
--   * automation_pending_executions, service-role only, no user policy.
-- ============================================================
