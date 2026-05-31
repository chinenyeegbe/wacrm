-- ============================================================
-- 021_partner_payouts.sql, Withdrawals for the partner network
--
-- Partners accrue earnings into referral_earnings (status 'accrued', from
-- migration 020). This adds the withdrawal side: a partner requests a
-- payout of their accrued balance; an operator marks it sent. The request
-- atomically claims the accrued rows so a balance can't be double-spent.
--
-- Tables:
--   partner_payouts, one row per withdrawal request (pending → paid /
--                     rejected), with the destination + amount snapshot.
--
-- The link between earnings and a payout is referral_earnings.payout_id
-- (added here). When a payout is requested, the eligible accrued rows are
-- stamped with the new payout_id and flipped to 'paid'; if the payout is
-- later rejected, they're released back to 'accrued'.
--
-- Additive & non-breaking. Idempotent, conventions from 001.
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  -- Amount requested, minor units. Snapshot of the accrued balance claimed.
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  -- Where the money should go (bank / mobile-money), snapshot at request
  -- time from partners.payout_details so later edits don't rewrite history.
  destination TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected')),
  -- Free-text note from whoever actions it (reference number / reason).
  note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner
  ON partner_payouts(partner_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status
  ON partner_payouts(status) WHERE status = 'pending';

ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;
-- Partners can read their own payouts; writes are server-side (the request
-- endpoint validates the balance with the service role).
DROP POLICY IF EXISTS "Partners view own payouts" ON partner_payouts;
CREATE POLICY "Partners view own payouts" ON partner_payouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners p
      WHERE p.id = partner_payouts.partner_id AND p.user_id = auth.uid()
    )
  );

-- Link earnings to the payout that settled them.
ALTER TABLE referral_earnings
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES partner_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_referral_earnings_payout
  ON referral_earnings(payout_id);

-- ------------------------------------------------------------
-- request_partner_payout(), atomically claim a partner's accrued
-- earnings into a new payout. SECURITY DEFINER so the balance check and
-- the row updates happen in one transaction the caller can't race.
-- Returns the new payout id, or NULL when there's nothing to withdraw.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_partner_payout(p_partner_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_currency TEXT;
  v_destination TEXT;
  v_payout_id UUID;
BEGIN
  -- Sum the partner's accrued, not-yet-paid earnings. Lock the rows so a
  -- concurrent request can't claim the same balance twice.
  SELECT COALESCE(SUM(amount_minor), 0), MIN(currency)
    INTO v_total, v_currency
  FROM referral_earnings
  WHERE partner_id = p_partner_id
    AND status = 'accrued'
    AND payout_id IS NULL
  FOR UPDATE;

  IF v_total <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT payout_details INTO v_destination FROM partners WHERE id = p_partner_id;

  INSERT INTO partner_payouts (partner_id, amount_minor, currency, destination, status)
  VALUES (p_partner_id, v_total, COALESCE(v_currency, 'NGN'), v_destination, 'pending')
  RETURNING id INTO v_payout_id;

  -- Claim the earnings: stamp them with this payout and mark paid-out.
  UPDATE referral_earnings
  SET payout_id = v_payout_id, status = 'paid'
  WHERE partner_id = p_partner_id
    AND status = 'accrued'
    AND payout_id IS NULL;

  RETURN v_payout_id;
END;
$$;

ALTER FUNCTION public.request_partner_payout(UUID) OWNER TO postgres;
