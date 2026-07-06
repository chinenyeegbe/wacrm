-- ============================================================
-- 021_playbooks.sql
--
-- Automated recurring playbooks — the "set-and-forget revenue engine"
-- from the audit (§7). A playbook is a saved smart audience + template
-- that the playbook cron runs on a cadence: it resolves the audience,
-- removes contacts messaged by the same playbook within a cooldown, and
-- enqueues a broadcast (which the existing broadcast runner sends).
--
--   audience_type   which smart audience (service_due / recently_
--                   completed / dormant)
--   window_days     the audience window
--   cooldown_days   don't re-message a contact from THIS playbook within
--                   this many days (prevents nagging)
--   enabled         off by default — the owner turns it on deliberately
--   last_run_at     so the cron runs each playbook at most once per day
--
-- Broadcasts created by a playbook carry `playbook_id` for attribution
-- and cooldown lookups.
--
-- MIGRATION REQUIRED: apply before deploying the matching app version.
-- ============================================================

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audience_type TEXT NOT NULL
    CHECK (audience_type IN ('service_due', 'recently_completed', 'dormant')),
  window_days INTEGER NOT NULL DEFAULT 30 CHECK (window_days > 0),
  cooldown_days INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_days >= 0),
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en_US',
  template_variables JSONB,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(user_id);
-- The cron scans enabled playbooks by last_run_at.
CREATE INDEX IF NOT EXISTS idx_playbooks_runner
  ON playbooks (enabled, last_run_at);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own playbooks" ON playbooks;
CREATE POLICY "Users can manage own playbooks" ON playbooks FOR ALL
  USING (auth.uid() = user_id);

-- Attribution + cooldown link from broadcasts back to their playbook.
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_broadcasts_playbook ON broadcasts(playbook_id);
