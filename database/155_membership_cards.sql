-- Animated membership promo card (compact banner) — text + multi-slot placements
-- Run after 153_membership_app_placements.sql

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS card_benefit_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS card_benefit_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS card_animated BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_placements JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN membership_plans.card_benefit_line_1 IS 'Promo card line 1 (animated banner)';
COMMENT ON COLUMN membership_plans.card_benefit_line_2 IS 'Promo card line 2 (animated banner)';
COMMENT ON COLUMN membership_plans.card_animated IS 'Blue/red color cycle on promo card';
COMMENT ON COLUMN membership_plans.card_placements IS 'Multi-slot promo card placements: home, search, services, rsa sections';

UPDATE membership_plans
SET
  card_benefit_line_1 = COALESCE(card_benefit_line_1, '10% off on all services'),
  card_benefit_line_2 = COALESCE(card_benefit_line_2, '5% cashback to wallet'),
  card_animated = COALESCE(card_animated, true)
WHERE upper(code) = 'PRIME';

UPDATE membership_plans
SET card_placements = CASE
  WHEN upper(COALESCE(membership_type, 'SERVICE')) = 'RSA' THEN '{"rsa":{"before_pricing":true}}'::jsonb
  ELSE '{"home":{"before_reviews":true},"search":{"after_smart_tools":true}}'::jsonb
END
WHERE card_placements = '{}'::jsonb;
