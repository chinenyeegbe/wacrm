-- ============================================================
-- 020 — Workspace invites (WhatsApp / link onboarding)
-- ============================================================
-- Idempotent. Builds on 017.
--
-- A pending invitation to join a workspace. The agency owner creates one
-- for a teammate; the link can be delivered over WhatsApp (from the
-- workspace's own number) or copied and shared manually. Redemption adds
-- the accepting user to workspace_members.
--
-- The token is the secret — redemption looks the invite up by token via
-- the service role (the invitee may not yet be a member, so RLS can't be
-- the lookup path). Owners manage their own workspaces' invites via RLS.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  -- E.164 phone the invite was sent to over WhatsApp, when applicable.
  -- Null for link-only invites.
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace
  ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token
  ON workspace_invites(token);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Agency owners see and manage invites for workspaces they own. Members
-- and the public never read this table through RLS — the accept path
-- uses the service role keyed on the secret token.
DROP POLICY IF EXISTS "Agency owners manage invites" ON workspace_invites;
CREATE POLICY "Agency owners manage invites" ON workspace_invites FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    JOIN agencies a ON a.id = w.agency_id
    WHERE w.id = workspace_invites.workspace_id AND a.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    JOIN agencies a ON a.id = w.agency_id
    WHERE w.id = workspace_invites.workspace_id AND a.owner_user_id = auth.uid()
  ));
