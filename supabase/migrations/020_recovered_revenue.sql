-- ============================================================
-- 020_recovered_revenue.sql
--
-- Recovered-revenue attribution on broadcast replies.
--
-- The webhook already flips a broadcast_recipients row to 'replied'
-- when the customer responds to a campaign message. These two columns
-- let the owner confirm what that reply was worth ("booked a boiler
-- service, £95") — or dismiss it (value 0) — so the dashboard can show
-- the headline number the product exists for: how much revenue
-- Moldlane recovered this month.
--
--   recovered_value  NUMERIC  — confirmed job value (0 = reply led to
--                               no job; NULL = not yet confirmed)
--   recovered_at     TIMESTAMPTZ — when the owner confirmed
--
-- MIGRATION REQUIRED: apply before deploying the matching app version.
-- ============================================================

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS recovered_value NUMERIC(12, 2);
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;

-- Monthly sums scan only confirmed rows.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_recovered
  ON broadcast_recipients (recovered_at)
  WHERE recovered_value IS NOT NULL;
