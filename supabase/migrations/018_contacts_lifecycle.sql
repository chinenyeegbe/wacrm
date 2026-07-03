-- ============================================================
-- 018_contacts_lifecycle.sql
--
-- Three additive changes to `contacts`, all nullable/backfilled so
-- existing rows and every current insert path keep working untouched:
--
--   1. `phone_normalized` — digits-only form of `phone`, maintained by
--      a trigger and indexed. Lets inbound-message contact lookup do an
--      indexed exact match instead of loading ALL of a user's contacts
--      and running JS `phonesMatch` on every webhook (the O(n)-per-
--      message scan flagged in the audit). The fuzzy trunk-prefix match
--      stays as a fallback in code for the rare non-exact case.
--
--   2. `marketing_opted_out_at` — set when a customer replies STOP (or
--      similar) over WhatsApp; broadcasts skip these contacts. Opt-out
--      handling in the send path is a WhatsApp policy + UK PECR / GDPR
--      requirement, not a nice-to-have.
--
--   3. Lightweight job-record fields (`last_service_date`,
--      `service_type`, `job_value`, `next_due_date`) — the minimal
--      per-customer service history the reactivation / service-due
--      playbooks are built on. Importable and editable; no separate
--      jobs table yet (deliberately minimal).
--
-- MIGRATION REQUIRED: apply this file (Supabase SQL editor or
-- `supabase db push`) before deploying the matching app version.
-- ============================================================

-- 1. Normalized phone -------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Keep it authoritative on every write path (webhook, CSV import,
-- manual add) without touching each insert site.
CREATE OR REPLACE FUNCTION set_contact_phone_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_normalized := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_phone_normalized ON contacts;
CREATE TRIGGER trg_contacts_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_contact_phone_normalized();

-- Backfill existing rows.
UPDATE contacts
  SET phone_normalized = regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
  WHERE phone_normalized IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized
  ON contacts (user_id, phone_normalized);

-- 2. Marketing opt-out ------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_opted_out_at TIMESTAMPTZ;

-- 3. Job-record fields ------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_service_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS job_value NUMERIC(12, 2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- Helps the service-due playbook find contacts whose next service is
-- due, scoped per user.
CREATE INDEX IF NOT EXISTS idx_contacts_next_due_date
  ON contacts (user_id, next_due_date)
  WHERE next_due_date IS NOT NULL;
