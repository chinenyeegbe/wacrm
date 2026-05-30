-- ============================================================
-- 020_referrals.sql — The partner / reseller network (network effect)
--
-- Lets any individual become a "partner" who sells wacrm to businesses in
-- their neighbourhood and earns a recurring share of the platform's
-- commission on every business they bring — forever. This is the growth
-- flywheel: partners are paid out of OUR margin (not added to the
-- merchant's bill), so their incentive is glued to ours.
--
-- Three tables:
--   partners          — a user's reseller identity: their shareable code,
--                       tier, and lifetime stats.
--   referrals         — the edge "this partner referred this business
--                       (workspace)". One business has at most one referrer.
--   referral_earnings — the immutable ledger: one row per partner payout
--                       event, written when a referred business's payment
--                       settles. Source of truth for what we owe.
--
-- Additive & non-breaking. Reads pair with src/lib/referrals/*.
-- Idempotent — conventions from 001_initial_schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- PARTNERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Shareable code, normalised (uppercase, no separators). Matches
  -- src/lib/referrals/codes.ts normalizeCode().
  code TEXT NOT NULL UNIQUE,
  -- Partner's current share of the platform fee, basis points. Set from
  -- the tier ladder (shareForCount) but stored so payouts are deterministic
  -- and auditable even if the ladder changes later.
  share_bps INTEGER NOT NULL DEFAULT 2000
    CHECK (share_bps >= 0 AND share_bps <= 10000),
  -- Denormalised lifetime stats for the dashboard (kept fresh by the app /
  -- a future RPC). Earnings in minor units.
  referred_count INTEGER NOT NULL DEFAULT 0,
  total_earned_minor BIGINT NOT NULL DEFAULT 0,
  -- Where to pay them (bank / mobile-money), free text for now.
  payout_details TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
-- A partner can see and manage only their own row.
DROP POLICY IF EXISTS "Partners manage own row" ON partners;
CREATE POLICY "Partners manage own row" ON partners FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON partners;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- REFERRALS — partner → referred business (workspace).
--
-- workspace_id references the referred business's workspace (migration
-- 019). A business has at most one referrer (UNIQUE), captured at signup.
-- The share_bps at capture time is frozen onto each earning row, not here,
-- so historical payouts never shift if the partner's tier changes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  -- The referred business. Nullable + SET NULL so history survives if the
  -- workspace is deleted.
  workspace_id UUID UNIQUE REFERENCES workspaces(id) ON DELETE SET NULL,
  -- Snapshot of how the link was made, for attribution debugging.
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'churned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_partner ON referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_workspace ON referrals(workspace_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- A partner can see referrals they made. Writes happen server-side (signup
-- attribution uses the service role), so no client INSERT policy.
DROP POLICY IF EXISTS "Partners view own referrals" ON referrals;
CREATE POLICY "Partners view own referrals" ON referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners p
      WHERE p.id = referrals.partner_id AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- REFERRAL_EARNINGS — immutable payout ledger.
--
-- One row each time a referred business's payment settles and the partner
-- is owed a cut. Written server-side from the payments webhook. amount_minor
-- is the partner's share; we also store the gross + fee for auditability.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  -- The payment that generated this earning (attribution back to the sale).
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL,
  gross_minor BIGINT NOT NULL CHECK (gross_minor >= 0),
  platform_fee_minor BIGINT NOT NULL CHECK (platform_fee_minor >= 0),
  -- The partner's share of that fee. The thing we owe them.
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  share_bps INTEGER NOT NULL CHECK (share_bps >= 0 AND share_bps <= 10000),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'paid', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_partner
  ON referral_earnings(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_payment
  ON referral_earnings(payment_request_id);

ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;
-- Partners can read their own earnings; all writes are server-side.
DROP POLICY IF EXISTS "Partners view own earnings" ON referral_earnings;
CREATE POLICY "Partners view own earnings" ON referral_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners p
      WHERE p.id = referral_earnings.partner_id AND p.user_id = auth.uid()
    )
  );
