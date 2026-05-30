-- ============================================================
-- 017_ai_settings.sql — Per-user AI configuration
--
-- Stores the workspace "business context" the AI uses to answer
-- accurately: catalogue, prices, opening hours, policies, tone. One
-- row per user. Read by the AI route and the automation engine's
-- ai_reply step so generated replies reflect the real business.
--
-- Idempotent — follows the conventions of 001_initial_schema.sql.
-- The ai_reply automation step itself needs NO schema change: it is a
-- new value of automation_steps.step_type (a free-text column) with its
-- prompt in the existing step_config JSONB.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Free-text knowledge the AI may rely on (catalogue, prices, hours,
  -- delivery, return policy, tone of voice). Kept as plain text so the
  -- owner can paste whatever they have; capped in the API, not here.
  business_context TEXT,
  -- Master switch. When false, the ai_reply step and the inbox ✨ button
  -- still work per-call, but auto-send automations can be paused fast.
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- How much the AI is allowed to do on its own. Human-in-the-loop is the
  -- DEFAULT (safest, builds trust), but a business can choose to run
  -- AI-only or keep AI purely as a draft assistant. The ai_reply step
  -- reads this so one setting changes behaviour everywhere:
  --   'assist'    — AI never auto-sends; only drafts (inbox ✨ button).
  --                 ai_reply steps are skipped.
  --   'human_loop'— AI auto-answers routine chats but hands flagged ones
  --                 (hot leads, complaints) to a human. DEFAULT.
  --   'autonomous'— AI handles everything itself, no human routing.
  autonomy TEXT NOT NULL DEFAULT 'human_loop'
    CHECK (autonomy IN ('assist', 'human_loop', 'autonomous')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For deployments that already created the table from an earlier copy of
-- this migration, add the column idempotently.
ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS autonomy TEXT NOT NULL DEFAULT 'human_loop';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_settings_autonomy_check'
  ) THEN
    ALTER TABLE ai_settings
      ADD CONSTRAINT ai_settings_autonomy_check
      CHECK (autonomy IN ('assist', 'human_loop', 'autonomous'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai settings" ON ai_settings;
CREATE POLICY "Users can manage own ai settings" ON ai_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON ai_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
