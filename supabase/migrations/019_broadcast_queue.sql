-- ============================================================
-- 019_broadcast_queue.sql
--
-- Moves broadcast sending from the browser to a server-side runner
-- drained on a schedule (see /api/broadcasts/cron). Previously the send
-- loop ran in the wizard tab (src/hooks/use-broadcast-sending.ts), so
-- closing the tab mid-send stopped the campaign and `scheduled_at` never
-- fired. Two new status values support the queue:
--
--   1. broadcasts.status 'queued' — recipients are persisted and the
--      broadcast is waiting for the runner to pick it up. The runner
--      claims it (→ 'sending'), drains pending recipients across as many
--      ticks as needed, then finalizes ('sent' / 'failed'). Future-dated
--      sends sit in 'scheduled' until `scheduled_at`.
--
--   2. broadcast_recipients.status 'skipped' — the recipient was
--      suppressed (opted out of marketing) and deliberately not sent.
--      The aggregate-count trigger (migration 005) already contributes
--      nothing for unknown statuses, so 'skipped' affects no counter.
--
-- MIGRATION REQUIRED: apply before deploying the matching app version.
-- ============================================================

-- Widen the broadcasts status CHECK to include 'queued'.
ALTER TABLE broadcasts DROP CONSTRAINT IF EXISTS broadcasts_status_check;
ALTER TABLE broadcasts ADD CONSTRAINT broadcasts_status_check
  CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'sent', 'failed'));

-- Widen the recipient status CHECK to include 'skipped'.
ALTER TABLE broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_status_check;
ALTER TABLE broadcast_recipients ADD CONSTRAINT broadcast_recipients_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed', 'skipped'));

-- Find broadcasts the runner should act on (queued / sending now, or a
-- scheduled one whose time has come).
CREATE INDEX IF NOT EXISTS idx_broadcasts_runner
  ON broadcasts (status, scheduled_at);

-- Drain pending recipients for a broadcast without scanning terminal
-- rows.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_pending
  ON broadcast_recipients (broadcast_id)
  WHERE status = 'pending';
