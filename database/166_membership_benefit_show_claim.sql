-- Admin toggle: show Claim button on this benefit in the customer app
ALTER TABLE public.membership_benefits
  ADD COLUMN IF NOT EXISTS show_claim_button BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.membership_benefits.show_claim_button IS 'When true, active members see a Claim button for this benefit in the app';

-- Default ON for standard Prime claimable benefits (admin can turn off anytime)
UPDATE public.membership_benefits
SET show_claim_button = TRUE
WHERE benefit_code IN ('PERIODIC_10_OFF', 'FREE_INSPECTION', 'FREE_SCAN', 'DAMAGE_ASSESS');
