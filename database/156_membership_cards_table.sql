-- Standalone membership promo cards (NOT tied to membership_plans)
-- Run after 155_membership_cards.sql (optional — old plan columns can stay)

CREATE TABLE IF NOT EXISTS membership_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  badge TEXT DEFAULT 'PRIME',
  benefit_line_1 TEXT DEFAULT '10% off on all services',
  benefit_line_2 TEXT DEFAULT '5% cashback to wallet',
  price NUMERIC NOT NULL DEFAULT 699,
  original_price NUMERIC DEFAULT 999,
  period_label TEXT DEFAULT '/ year',
  card_animated BOOLEAN NOT NULL DEFAULT true,
  card_style TEXT NOT NULL DEFAULT 'SERVICE' CHECK (card_style IN ('SERVICE', 'RSA')),
  cta_membership_type TEXT DEFAULT 'SERVICE' CHECK (cta_membership_type IN ('SERVICE', 'RSA')),
  cta_plan_code TEXT,
  placements JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_cards_active ON membership_cards (active, display_order);

COMMENT ON TABLE membership_cards IS 'Independent animated promo cards for app screens';
COMMENT ON COLUMN membership_cards.card_style IS 'SERVICE = blue/red cycle, RSA = red theme';
COMMENT ON COLUMN membership_cards.placements IS 'Multi-slot: home, search, services, rsa sections';
COMMENT ON COLUMN membership_cards.cta_plan_code IS 'Optional — open specific plan on tap; leave blank for membership page only';

-- Seed from legacy plan columns if present (one card per plan that had placements)
INSERT INTO membership_cards (
  title, badge, benefit_line_1, benefit_line_2, price, original_price, period_label,
  card_animated, card_style, cta_membership_type, cta_plan_code, placements, display_order, active
)
SELECT
  p.name,
  COALESCE(p.badge, 'PRIME'),
  COALESCE(p.card_benefit_line_1, '10% off on all services'),
  COALESCE(p.card_benefit_line_2, '5% cashback to wallet'),
  COALESCE(p.price, 699),
  p.original_price,
  COALESCE(p.period_label, '/ year'),
  COALESCE(p.card_animated, true),
  CASE WHEN upper(COALESCE(p.membership_type, 'SERVICE')) = 'RSA' THEN 'RSA' ELSE 'SERVICE' END,
  CASE WHEN upper(COALESCE(p.membership_type, 'SERVICE')) = 'RSA' THEN 'RSA' ELSE 'SERVICE' END,
  p.code,
  COALESCE(p.card_placements, '{}'::jsonb),
  COALESCE(p.display_order, 0),
  COALESCE(p.active, true)
FROM membership_plans p
WHERE p.card_placements IS NOT NULL
  AND p.card_placements <> '{}'::jsonb
  AND NOT EXISTS (SELECT 1 FROM membership_cards mc WHERE mc.title = p.name AND mc.cta_plan_code IS NOT DISTINCT FROM p.code);

-- Default Prime card if table empty
INSERT INTO membership_cards (
  title, badge, benefit_line_1, benefit_line_2, price, original_price,
  card_style, cta_membership_type, cta_plan_code, placements, display_order
)
SELECT
  'MyFNG Prime', 'PRIME', '10% off on all services', '5% cashback to wallet',
  699, 999, 'SERVICE', 'SERVICE', 'PRIME',
  '{"home":{"before_reviews":true},"search":{"after_smart_tools":true}}'::jsonb,
  1
WHERE NOT EXISTS (SELECT 1 FROM membership_cards);
