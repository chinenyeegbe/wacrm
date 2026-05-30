-- ============================================================
-- 019_workspaces.sql — Agency mode, part 1: the membership graph
--
-- This is the FOUNDATION for multi-tenant / agency mode (one operator
-- managing many businesses). It is deliberately ADDITIVE and NON-BREAKING:
--   • It creates `workspaces` + `workspace_members`.
--   • It backfills a personal workspace for every existing user, with that
--     user as the owner, so nothing about today's single-user behaviour
--     changes.
--   • It does NOT yet alter any existing table's RLS. The cutover (adding
--     workspace_id to tenant tables and switching RLS predicates to
--     "membership of the workspace") is a separate, DB-tested migration
--     (020) so this one can ship and be verified in isolation.
--
-- The roles mirror src/lib/workspaces/roles.ts:
--   viewer < agent < operator < owner.
--
-- Idempotent — follows the conventions of 001_initial_schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- WORKSPACES — one row per business.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  -- The current billing/responsible owner. A convenience pointer; the
  -- authoritative role list lives in workspace_members. Nullable so the
  -- owner's account can be deleted without nuking the business history.
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 'personal' workspaces are auto-created per user (the single-user
  -- default); 'business' workspaces are created explicitly in agency mode.
  kind TEXT NOT NULL DEFAULT 'personal'
    CHECK (kind IN ('personal', 'business')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- ------------------------------------------------------------
-- WORKSPACE_MEMBERS — who belongs to a workspace, and as what.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('viewer', 'agent', 'operator', 'owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A user has exactly one role per workspace.
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
  ON workspace_members(workspace_id);

-- ------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER) used by RLS in migration 020.
--
-- Defining them now keeps 020 focused purely on the predicate swap. They
-- are SECURITY DEFINER so an RLS policy that calls them does not itself
-- recurse into workspace_members' own RLS (which would deadlock the
-- policy evaluation).
-- ------------------------------------------------------------

-- Is the current user a member of this workspace (any role)?
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
  );
$$;

-- Does the current user hold AT LEAST the given role in this workspace?
-- Role ranking matches src/lib/workspaces/roles.ts.
CREATE OR REPLACE FUNCTION public.has_workspace_role(
  p_workspace_id UUID,
  p_min_role TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND CASE m.role
            WHEN 'viewer' THEN 0
            WHEN 'agent' THEN 1
            WHEN 'operator' THEN 2
            WHEN 'owner' THEN 3
          END
        >=
          CASE p_min_role
            WHEN 'viewer' THEN 0
            WHEN 'agent' THEN 1
            WHEN 'operator' THEN 2
            WHEN 'owner' THEN 3
          END
  );
$$;

ALTER FUNCTION public.is_workspace_member(UUID) OWNER TO postgres;
ALTER FUNCTION public.has_workspace_role(UUID, TEXT) OWNER TO postgres;

-- ------------------------------------------------------------
-- RLS for the two new tables themselves.
-- ------------------------------------------------------------
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Members can see workspaces they belong to.
DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
CREATE POLICY "Members can view their workspaces" ON workspaces FOR SELECT
  USING (public.is_workspace_member(id));

-- Only owners can rename / change / delete a workspace.
DROP POLICY IF EXISTS "Owners can update their workspace" ON workspaces;
CREATE POLICY "Owners can update their workspace" ON workspaces FOR UPDATE
  USING (public.has_workspace_role(id, 'owner'));

DROP POLICY IF EXISTS "Owners can delete their workspace" ON workspaces;
CREATE POLICY "Owners can delete their workspace" ON workspaces FOR DELETE
  USING (public.has_workspace_role(id, 'owner'));

-- Any authenticated user can create a workspace (they become its owner via
-- the application layer / the membership insert below).
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
CREATE POLICY "Users can create workspaces" ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Members can see the membership list of workspaces they're in.
DROP POLICY IF EXISTS "Members can view co-members" ON workspace_members;
CREATE POLICY "Members can view co-members" ON workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Only owners manage membership (add/change/remove). The application layer
-- additionally enforces canAssignRole() so an owner can't be minted by a
-- non-owner; here we gate the whole write surface on owner.
DROP POLICY IF EXISTS "Owners manage membership" ON workspace_members;
CREATE POLICY "Owners manage membership" ON workspace_members FOR ALL
  USING (public.has_workspace_role(workspace_id, 'owner'))
  WITH CHECK (public.has_workspace_role(workspace_id, 'owner'));

DROP TRIGGER IF EXISTS set_updated_at ON workspaces;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- BACKFILL — give every existing user a personal workspace they own.
-- Safe to re-run: the NOT EXISTS guards skip users already migrated.
-- ------------------------------------------------------------
INSERT INTO workspaces (name, owner_id, kind)
SELECT
  COALESCE(NULLIF(p.full_name, ''), split_part(p.email, '@', 1), 'My workspace'),
  p.user_id,
  'personal'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.owner_id = p.user_id AND w.kind = 'personal'
);

-- Add each user as OWNER of their personal workspace.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w
WHERE w.kind = 'personal'
  AND w.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
  );

-- ------------------------------------------------------------
-- New signups get a personal workspace automatically. We extend the
-- existing handle_new_user() flow with a second trigger rather than
-- editing it, so the profile-creation path stays untouched.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (name, owner_id, kind)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
             split_part(NEW.email, '@', 1),
             'My workspace'),
    NEW.id,
    'personal'
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup on workspace creation; it can be backfilled.
  RAISE WARNING 'Failed to create workspace for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user_workspace() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();
