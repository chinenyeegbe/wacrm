-- ============================================================
-- 011_payments.sql, Payments rail (the commission engine)
--
-- Two tables:
--   payment_config, one row per user: which PSP, encrypted secret,
--                      default currency, and the PLATFORM FEE in basis
--                      points. This bps value is the whole business model:
--                      money moves through links we mint, so the fee is
--                      taken at settlement, never invoiced.
--   payment_requests, one row per payment link minted, with attribution
--                      back to the conversation / automation that closed it
--                      so "the AI earned this" is provable and auditable.
--
-- Webhooks from the PSP flip status pending → paid and are processed
-- server-side with the service-role key (like the WhatsApp webhook), so
-- no INSERT/UPDATE policy is exposed to authenticated users on
-- payment_requests beyond SELECT of their own rows.
--
-- Idempotent, follows the conventions of 001_initial_schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- PAYMENT_CONFIG
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (provider IN ('paystack', 'flutterwave', 'manual')),
  -- Encrypted at rest (AES-256-GCM) by the app, same as whatsapp_config.
  secret_key TEXT,
  -- For provider='manual': free-text bank / mobile-money instructions.
  manual_instructions TEXT,
  default_currency TEXT NOT NULL DEFAULT 'NGN',
  -- Platform commission, basis points. 0 = off (self-hosters keep 100%).
  platform_fee_bps INTEGER NOT NULL DEFAULT 0
    CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000),
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_config_user_id ON payment_config(user_id);

ALTER TABLE payment_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own payment config" ON payment_config;
CREATE POLICY "Users can manage own payment config" ON payment_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON payment_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- PAYMENT_REQUESTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nullable so history survives contact/conversation deletion
  -- (mirrors migration 004's ON DELETE SET NULL pattern).
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'flutterwave', 'manual')),
  -- Provider transaction reference; unique per user for idempotency.
  reference TEXT NOT NULL,
  -- Minor units (kobo/cents), integer math only, no float drift.
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  description TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled')),
  platform_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user
  ON payment_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_contact
  ON payment_requests(contact_id);
-- Webhook lookup path: find a row by its provider reference fast.
CREATE INDEX IF NOT EXISTS idx_payment_requests_reference
  ON payment_requests(reference);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
-- Users can READ their own payment history (the inbox / dashboard shows it),
-- but writes come from server-side routes using the service-role key:
-- the create endpoint (after auth) and the PSP webhook. Keeping writes off
-- the client prevents a user from marking their own request 'paid'.
DROP POLICY IF EXISTS "Users can view own payment requests" ON payment_requests;
CREATE POLICY "Users can view own payment requests" ON payment_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON payment_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
