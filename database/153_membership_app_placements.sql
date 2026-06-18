-- Membership: SERVICE vs RSA segregation, app hide/show, per-screen placement (Android & iOS)
-- Run after 152_membership_value_card_cms.sql

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS membership_type text NOT NULL DEFAULT 'SERVICE',
  ADD COLUMN IF NOT EXISTS app_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS app_placements jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_plans_membership_type_check'
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_membership_type_check
      CHECK (membership_type IN ('SERVICE', 'RSA'));
  END IF;
END $$;

COMMENT ON COLUMN membership_plans.membership_type IS 'SERVICE = car service Prime; RSA = roadside assistance membership';
COMMENT ON COLUMN membership_plans.app_visible IS 'When false, plan stays active for backend/purchases but hidden from app UI slots';
COMMENT ON COLUMN membership_plans.app_placements IS 'Per-screen banner/value-card slots, e.g. home.before_reviews, rsa.before_pricing';

-- Existing PRIME: keep current app behaviour
UPDATE membership_plans
SET
  membership_type = 'SERVICE',
  app_visible = true,
  app_placements = jsonb_build_object(
    'settings_page', true,
    'search_banner', true,
    'search_grid', true,
    'home', jsonb_build_object(
      'after_services', true,
      'after_loan_card', true,
      'before_reviews', true
    ),
    'services', jsonb_build_object(
      'before_why_myfng', true
    )
  )
WHERE upper(code) = 'PRIME';
