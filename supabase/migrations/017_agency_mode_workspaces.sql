-- ============================================================
-- 017 — Agency mode: workspace tenancy + RLS cutover
-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/columns/indexes and DROP IF EXISTS
-- for policies (Postgres has no CREATE POLICY IF NOT EXISTS).
--
-- WHAT THIS DOES
--   wacrm shipped strictly single-tenant: every table carried a
--   `user_id` and every RLS policy was `auth.uid() = user_id`, so one
--   login owned one silo of data. This migration introduces the
--   agency-mode tenancy layer:
--
--       agency (owner)  →  many workspaces (clients)  →  many members
--
--   and cuts RLS over from "you own the row" to "you can access the
--   row's workspace". Workspace access = you are a member of that
--   workspace, OR you own the agency the workspace belongs to (agency
--   staff get blanket access to every client workspace they manage).
--
-- WHY IT IS NON-BREAKING
--   Every tenant table already has a `user_id` column. The backfill
--   gives every existing user their own agency + a single "Default
--   workspace" and stamps their rows with it, so nothing moves owners.
--   A BEFORE INSERT trigger then derives `workspace_id` from
--   COALESCE(NEW.user_id, auth.uid()) whenever a caller omits it — so
--   BOTH the interactive app (auth.uid()) AND the service-role webhook /
--   automation / flow engines (which always set user_id) keep writing
--   valid rows with no application-code change required. The RLS layer
--   underneath is what changed; the insert contracts did not.
--
-- THE SAFETY GATE
--   Cutting RLS from per-user to per-workspace means a single wrong
--   policy silently leaks one tenant's inbox into another's. Run
--   supabase/tests/017_agency_rls_leak_test.sql against a real DB after
--   applying this — it seeds two agencies and asserts neither can read
--   or write the other across every tenant table. Do NOT ship without
--   a green run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TENANCY TABLES
-- ============================================================

-- An agency is owned by exactly one user. The owner is agency staff
-- and implicitly has access to every workspace under the agency.
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Agency',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agencies_owner ON agencies(owner_user_id);

-- A workspace is one client under an agency. All tenant data hangs off
-- a workspace.
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default workspace',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_agency ON workspaces(agency_id);

-- A membership ties a human (team member) to a specific workspace. This
-- is the "membership AND the specific workspace" half of the access
-- check; the agency-owner half is handled in can_access_workspace().
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);

-- updated_at triggers (reuse update_updated_at_column() from 001)
DROP TRIGGER IF EXISTS set_updated_at ON agencies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at ON workspaces;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. ACCESS HELPERS
-- ============================================================
-- SECURITY DEFINER + OWNER postgres: the function body runs as the
-- table owner, which bypasses RLS. That is what prevents infinite
-- recursion — a policy on `contacts` calls can_access_workspace(),
-- which reads workspace_members WITHOUT re-triggering workspace_members'
-- own policies. STABLE so the planner can cache it within a statement.

CREATE OR REPLACE FUNCTION public.can_access_workspace(w_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = w_id
      AND m.user_id = auth.uid()
  ) OR EXISTS (
    -- Agency owners get blanket access to every workspace they manage.
    SELECT 1 FROM workspaces w
    JOIN agencies a ON a.id = w.agency_id
    WHERE w.id = w_id
      AND a.owner_user_id = auth.uid()
  );
$$;
ALTER FUNCTION public.can_access_workspace(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.can_access_agency(a_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.id = a_id
      AND a.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.agency_id = a_id
      AND m.user_id = auth.uid()
  );
$$;
ALTER FUNCTION public.can_access_agency(uuid) OWNER TO postgres;

-- Resolve a user's default workspace: the oldest workspace in the
-- agency they own. Used by the insert trigger to fill workspace_id and
-- to preserve single-tenant behaviour for existing logins.
CREATE OR REPLACE FUNCTION public.default_workspace_for(u uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id
  FROM workspaces w
  JOIN agencies a ON a.id = w.agency_id
  WHERE a.owner_user_id = u
  ORDER BY w.created_at, w.id
  LIMIT 1;
$$;
ALTER FUNCTION public.default_workspace_for(uuid) OWNER TO postgres;

-- ============================================================
-- 3. RLS ON THE TENANCY TABLES THEMSELVES
-- ============================================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their agency" ON agencies;
CREATE POLICY "Members read their agency" ON agencies FOR SELECT
  USING (can_access_agency(id));
DROP POLICY IF EXISTS "Owners manage their agency" ON agencies;
CREATE POLICY "Owners manage their agency" ON agencies FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their workspaces" ON workspaces;
CREATE POLICY "Members read their workspaces" ON workspaces FOR SELECT
  USING (can_access_workspace(id));
DROP POLICY IF EXISTS "Agency owners manage workspaces" ON workspaces;
CREATE POLICY "Agency owners manage workspaces" ON workspaces FOR ALL
  USING (EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.id = workspaces.agency_id AND a.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.id = workspaces.agency_id AND a.owner_user_id = auth.uid()
  ));

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read co-members" ON workspace_members;
CREATE POLICY "Members read co-members" ON workspace_members FOR SELECT
  USING (can_access_workspace(workspace_id));
-- Only the agency owner administers membership (invite / remove / role).
DROP POLICY IF EXISTS "Agency owners manage membership" ON workspace_members;
CREATE POLICY "Agency owners manage membership" ON workspace_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    JOIN agencies a ON a.id = w.agency_id
    WHERE w.id = workspace_members.workspace_id AND a.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    JOIN agencies a ON a.id = w.agency_id
    WHERE w.id = workspace_members.workspace_id AND a.owner_user_id = auth.uid()
  ));

-- ============================================================
-- 4. ADD workspace_id TO TENANT TABLES (nullable first, backfill, then
--    NOT NULL). Server-only `automation_pending_executions` is left
--    untouched — it has no authenticated policy, so it is already
--    invisible to clients; the engine scopes it via automation_id.
-- ============================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes', 'conversations',
    'whatsapp_config', 'message_templates', 'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs', 'flows', 'flow_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 5. BACKFILL — one agency + workspace + owner membership per existing
--    user, then stamp every existing row. All idempotent.
-- ============================================================
-- Source owners from every user_id that actually owns tenant data (not
-- just profiles) so a row whose historical profile insert failed still
-- gets a workspace — otherwise the SET NOT NULL below would error.
INSERT INTO agencies (owner_user_id, name)
SELECT DISTINCT u.user_id, COALESCE(NULLIF(p.full_name, ''), 'My Agency')
FROM (
  SELECT user_id FROM profiles
  UNION SELECT user_id FROM contacts
  UNION SELECT user_id FROM tags
  UNION SELECT user_id FROM custom_fields
  UNION SELECT user_id FROM contact_notes
  UNION SELECT user_id FROM conversations
  UNION SELECT user_id FROM whatsapp_config
  UNION SELECT user_id FROM message_templates
  UNION SELECT user_id FROM pipelines
  UNION SELECT user_id FROM deals
  UNION SELECT user_id FROM broadcasts
  UNION SELECT user_id FROM automations
  UNION SELECT user_id FROM automation_logs
  UNION SELECT user_id FROM flows
  UNION SELECT user_id FROM flow_runs
) u
LEFT JOIN profiles p ON p.user_id = u.user_id
WHERE u.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM agencies a WHERE a.owner_user_id = u.user_id);

INSERT INTO workspaces (agency_id, name)
SELECT a.id, 'Default workspace'
FROM agencies a
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.agency_id = a.id);

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, a.owner_user_id, 'owner'
FROM workspaces w
JOIN agencies a ON a.id = w.agency_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = a.owner_user_id
);

-- Stamp each tenant table from its user_id via the 1:1 user→workspace map.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes', 'conversations',
    'whatsapp_config', 'message_templates', 'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs', 'flows', 'flow_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format($f$
      UPDATE %I tbl
      SET workspace_id = m.workspace_id
      FROM (
        SELECT a.owner_user_id AS user_id, w.id AS workspace_id
        FROM workspaces w JOIN agencies a ON a.id = w.agency_id
      ) m
      WHERE m.user_id = tbl.user_id AND tbl.workspace_id IS NULL
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- 6. ENFORCE NOT NULL + index workspace_id for fast RLS lookups.
-- ============================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes', 'conversations',
    'whatsapp_config', 'message_templates', 'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs', 'flows', 'flow_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(workspace_id)',
      'idx_' || t || '_workspace_id', t
    );
  END LOOP;
END $$;

-- ============================================================
-- 7. AUTO-FILL workspace_id ON INSERT
-- ============================================================
-- Derives workspace_id from the row's own user_id (set by every
-- existing insert path, interactive and service-role) or, failing that,
-- the authenticated caller. This is why no application code had to
-- change: existing inserts that only set user_id still land in the
-- right workspace. Explicitly-supplied workspace_id always wins.
CREATE OR REPLACE FUNCTION public.wacrm_fill_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    target_user := COALESCE(NEW.user_id, auth.uid());
    NEW.workspace_id := public.default_workspace_for(target_user);
    IF NEW.workspace_id IS NULL THEN
      RAISE EXCEPTION
        'wacrm_fill_workspace_id: cannot resolve a workspace for user % on table %',
        target_user, TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.wacrm_fill_workspace_id() OWNER TO postgres;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes', 'conversations',
    'whatsapp_config', 'message_templates', 'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs', 'flows', 'flow_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS fill_workspace_id ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER fill_workspace_id BEFORE INSERT ON %I
         FOR EACH ROW EXECUTE FUNCTION public.wacrm_fill_workspace_id()',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 8. whatsapp_config: a number now belongs to a WORKSPACE, not a user.
--    Swap the single-tenant UNIQUE(user_id) for UNIQUE(workspace_id).
--    (phone_number_id stays globally unique — see migration 013.)
-- ============================================================
ALTER TABLE whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_config_workspace_id_key'
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_workspace_id_key UNIQUE (workspace_id);
  END IF;
END $$;

-- ============================================================
-- 9. RLS CUTOVER — replace every `auth.uid() = user_id` policy with a
--    workspace-membership check. Root tables key off their own
--    workspace_id; child tables key off their parent's workspace_id.
--    profiles is intentionally left per-user: it is identity, not
--    tenant data — one human keeps one profile across every workspace.
-- ============================================================

-- ---- Root tables (own workspace_id) ----
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Workspace members manage contacts" ON contacts FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY "Workspace members manage tags" ON tags FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY "Workspace members manage custom fields" ON custom_fields FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY "Workspace members manage notes" ON contact_notes FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Workspace members manage conversations" ON conversations FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY "Workspace members manage config" ON whatsapp_config FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY "Workspace members manage templates" ON message_templates FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY "Workspace members manage pipelines" ON pipelines FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY "Workspace members manage deals" ON deals FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY "Workspace members manage broadcasts" ON broadcasts FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
CREATE POLICY "Workspace members manage automations" ON automations FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
CREATE POLICY "Workspace members view automation logs" ON automation_logs FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can manage own flows" ON flows;
CREATE POLICY "Workspace members manage flows" ON flows FOR ALL
  USING (can_access_workspace(workspace_id))
  WITH CHECK (can_access_workspace(workspace_id));

DROP POLICY IF EXISTS "Users see own flow runs" ON flow_runs;
CREATE POLICY "Workspace members see flow runs" ON flow_runs FOR SELECT
  USING (can_access_workspace(workspace_id));

-- ---- Child tables (parent's workspace_id) ----
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Workspace members manage contact tags" ON contact_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_tags.contact_id AND can_access_workspace(c.workspace_id)
  ));

DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY "Workspace members manage custom values" ON contact_custom_values FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_custom_values.contact_id AND can_access_workspace(c.workspace_id)
  ));

DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Workspace members access messages" ON messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND can_access_workspace(c.workspace_id)
  ));
-- "Service role can insert messages" (WITH CHECK true) is left intact —
-- the webhook writes inbound messages via the service-role key.

DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Workspace members manage pipeline stages" ON pipeline_stages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_stages.pipeline_id AND can_access_workspace(p.workspace_id)
  ));

DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Workspace members manage broadcast recipients" ON broadcast_recipients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM broadcasts b
    WHERE b.id = broadcast_recipients.broadcast_id AND can_access_workspace(b.workspace_id)
  ));

DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
CREATE POLICY "Workspace members manage automation steps" ON automation_steps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = automation_steps.automation_id AND can_access_workspace(a.workspace_id)
  ));

DROP POLICY IF EXISTS "Users manage nodes on their flows" ON flow_nodes;
CREATE POLICY "Workspace members manage flow nodes" ON flow_nodes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id AND can_access_workspace(f.workspace_id)
  ));

DROP POLICY IF EXISTS "Users see events on their runs" ON flow_run_events;
CREATE POLICY "Workspace members see flow run events" ON flow_run_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM flow_runs r
    WHERE r.id = flow_run_events.flow_run_id AND can_access_workspace(r.workspace_id)
  ));

-- message_reactions: workspace scopes visibility/insert; the "own agent
-- reaction" guard (actor_id = auth.uid()) is preserved on delete/update
-- so a member can only modify reactions they personally added, even
-- within a shared workspace.
DROP POLICY IF EXISTS "Users see reactions on their conversations" ON message_reactions;
CREATE POLICY "Workspace members see reactions" ON message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = message_reactions.conversation_id AND can_access_workspace(c.workspace_id)
  ));

DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON message_reactions;
CREATE POLICY "Workspace members insert reactions" ON message_reactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = message_reactions.conversation_id AND can_access_workspace(c.workspace_id)
  ));

DROP POLICY IF EXISTS "Users delete their own agent reactions" ON message_reactions;
CREATE POLICY "Members delete own agent reactions" ON message_reactions FOR DELETE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id AND can_access_workspace(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Users update their own agent reactions" ON message_reactions;
CREATE POLICY "Members update own agent reactions" ON message_reactions FOR UPDATE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id AND can_access_workspace(c.workspace_id)
    )
  );

-- ============================================================
-- 10. NEW-USER BOOTSTRAP — every signup gets a personal agency + a
--     default workspace + owner membership, so the invariant "every
--     user owns exactly one workspace" holds for new accounts too
--     (default_workspace_for() and the insert trigger depend on it).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agency_id uuid;
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE owner_user_id = NEW.id) THEN
    INSERT INTO public.agencies (owner_user_id, name)
    VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'My Agency'))
    RETURNING id INTO new_agency_id;

    INSERT INTO public.workspaces (agency_id, name)
    VALUES (new_agency_id, 'Default workspace')
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup; the bootstrap can be retried/repaired later.
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- on_auth_user_created trigger already exists from migration 001 and
-- points at handle_new_user() — replacing the function body is enough.
