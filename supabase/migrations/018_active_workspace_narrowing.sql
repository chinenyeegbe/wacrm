-- ============================================================
-- 018 — Active-workspace narrowing for agency mode
-- ============================================================
-- Idempotent. Builds on 017.
--
-- WHAT & WHY
--   017 scoped every tenant table to "any workspace the user can
--   access" (can_access_workspace). That is correct for isolation, but
--   an agency owner who belongs to several client workspaces would see
--   ALL of them mixed together in the inbox, contacts, etc. Agency mode
--   needs a single "active workspace" the user is currently working in.
--
--   Rather than add `.eq('workspace_id', active)` to dozens of queries
--   (the app deliberately never filters by owner — RLS does the
--   scoping; see src/lib/dashboard/queries.ts), we narrow inside RLS.
--   The server Supabase client sends the active workspace as an
--   `x-workspace-id` request header; PostgREST exposes it via
--   `current_setting('request.headers')`, and the policy restricts rows
--   to it.
--
-- SAFE BY CONSTRUCTION
--   The new predicate is `can_access_workspace(w) AND (no header OR
--   w = header)`. The can_access check is ALWAYS required, so the
--   header can only ever NARROW the set within workspaces the user can
--   already access — it can never widen it. Worst case of a header bug
--   is a user seeing more of THEIR OWN workspaces than intended, never
--   another tenant's data. With no header present (the current app and
--   the 017 leak test), behaviour is identical to 017.
--
--   Child tables inherit the narrowing automatically: their policies
--   already gate on EXISTS(SELECT 1 FROM <parent> ...), and RLS applies
--   to that subquery, so a parent hidden by the active filter hides its
--   children too. Only the 14 root tables change here.
-- ============================================================

-- A row passes if the user can access its workspace AND, when an
-- active-workspace header is set, the row is in that workspace.
CREATE OR REPLACE FUNCTION public.in_active_workspace(w_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    can_access_workspace(w_id)
    AND (
      -- header absent / blank -> no narrowing (back-compat)
      nullif(current_setting('request.headers', true), '') IS NULL
      OR nullif(current_setting('request.headers', true)::json ->> 'x-workspace-id', '') IS NULL
      -- header present -> row must match it
      OR w_id::text = (current_setting('request.headers', true)::json ->> 'x-workspace-id')
    );
$$;

-- Re-point the 14 root-table policies from can_access_workspace() to
-- in_active_workspace(). Names match those created in 017.
DROP POLICY IF EXISTS "Workspace members manage contacts" ON contacts;
CREATE POLICY "Workspace members manage contacts" ON contacts FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage tags" ON tags;
CREATE POLICY "Workspace members manage tags" ON tags FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage custom fields" ON custom_fields;
CREATE POLICY "Workspace members manage custom fields" ON custom_fields FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage notes" ON contact_notes;
CREATE POLICY "Workspace members manage notes" ON contact_notes FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage conversations" ON conversations;
CREATE POLICY "Workspace members manage conversations" ON conversations FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage config" ON whatsapp_config;
CREATE POLICY "Workspace members manage config" ON whatsapp_config FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage templates" ON message_templates;
CREATE POLICY "Workspace members manage templates" ON message_templates FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage pipelines" ON pipelines;
CREATE POLICY "Workspace members manage pipelines" ON pipelines FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage deals" ON deals;
CREATE POLICY "Workspace members manage deals" ON deals FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage broadcasts" ON broadcasts;
CREATE POLICY "Workspace members manage broadcasts" ON broadcasts FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage automations" ON automations;
CREATE POLICY "Workspace members manage automations" ON automations FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members view automation logs" ON automation_logs;
CREATE POLICY "Workspace members view automation logs" ON automation_logs FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage flows" ON flows;
CREATE POLICY "Workspace members manage flows" ON flows FOR ALL
  USING (in_active_workspace(workspace_id))
  WITH CHECK (in_active_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members see flow runs" ON flow_runs;
CREATE POLICY "Workspace members see flow runs" ON flow_runs FOR SELECT
  USING (in_active_workspace(workspace_id));
