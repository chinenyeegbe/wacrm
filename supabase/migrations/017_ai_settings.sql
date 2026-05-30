-- ============================================================
-- 010_ai_settings.sql — Per-user AI configuration
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai settings" ON ai_settings;
CREATE POLICY "Users can manage own ai settings" ON ai_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON ai_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
