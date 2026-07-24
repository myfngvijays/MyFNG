-- Refer & Rise claimed rewards → coupon vouchers with expiry
BEGIN;

ALTER TABLE public.referral_milestone_claims
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_assignment_id UUID REFERENCES public.customer_coupon_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_milestone_claims_expires
  ON public.referral_milestone_claims (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestone_claims_coupon
  ON public.referral_milestone_claims (coupon_id)
  WHERE coupon_id IS NOT NULL;

COMMENT ON COLUMN public.referral_milestone_claims.expires_at IS 'Referral reward voucher expiry (default 365 days from claim)';
COMMENT ON COLUMN public.referral_milestone_claims.coupon_id IS 'Linked booking coupon created when reward is claimed';

COMMIT;
