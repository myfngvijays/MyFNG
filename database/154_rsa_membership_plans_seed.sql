-- Seed 5 RSA membership tiers: Basic, Family, Plus, Premium, Elite
-- Run after 153_membership_app_placements.sql
-- Removes legacy test RSA plan (code RSA) and the 15 Years / 50 Services tier.

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20);

COMMENT ON COLUMN public.membership_plans.accent_color IS 'Hex accent for RSA plan cards in app (header, CTA, gradient)';

-- Hide legacy singleton RSA test plan
UPDATE public.membership_plans
SET active = false, app_visible = false, updated_at = NOW()
WHERE upper(code) = 'RSA' AND membership_type = 'RSA';

-- Upsert 5 RSA plans
INSERT INTO public.membership_plans (
  code, name, description, price, original_price, duration_days,
  active, membership_type, app_visible, display_order,
  tagline, badge, period_label, footer_note,
  total_benefits_value, value_column_label, total_benefits_label, save_label,
  price_hero_label, price_hero_sub,
  second_car_addon_price, second_car_addon_title, second_car_addon_description, second_car_addon_icon,
  accent_color, app_placements
) VALUES
  (
    'RSA_BASIC', 'Basic', 'Essential roadside cover for everyday emergencies',
    999, 1299, 365, true, 'RSA', true, 1,
    'Perfect for single-car owners', 'RSA BASIC', '1 Year · 2 Services',
    'Valid 12 months · 2 RSA service calls included · Linked to registered mobile',
    2500, 'VALUE', 'Total Benefits Value', 'You Save',
    'YOU PAY ONLY', '2 roadside assists · One full year · One car',
    299, '2nd Car Add-On', 'Same RSA benefits for your second car', 'car-sport',
    '#F97316',
    '{"settings_page":true,"search_banner":false,"search_grid":false,"rsa":{"before_pricing":true}}'::jsonb
  ),
  (
    'RSA_FAMILY', 'Family', 'Cover the whole family fleet with more service calls',
    2999, 3999, 1825, true, 'RSA', true, 2,
    'Best for families with multiple cars', 'RSA FAMILY', '5 Years · 10 Services',
    'Valid 5 years · 10 RSA service calls · All cars on your account',
    8500, 'VALUE', 'Total Benefits Value', 'You Save',
    'YOU PAY ONLY', '10 roadside assists · Five full years · One car',
    299, '2nd Car Add-On', 'Extend RSA cover to another family car', 'car-sport',
    '#2563EB',
    '{"settings_page":true,"search_banner":false,"search_grid":false,"rsa":{"before_pricing":true}}'::jsonb
  ),
  (
    'RSA_PLUS', 'Plus', 'Long-term RSA peace of mind with generous service quota',
    4999, 6499, 5475, true, 'RSA', true, 3,
    'Long-term roadside protection', 'RSA PLUS', '15 Years · 30 Services',
    'Valid 15 years · 30 RSA service calls · Priority dispatch',
    18000, 'VALUE', 'Total Benefits Value', 'You Save',
    'YOU PAY ONLY', '30 roadside assists · Fifteen full years · One car',
    299, '2nd Car Add-On', 'Add a second car to your RSA Plus plan', 'car-sport',
    '#7C3AED',
    '{"settings_page":true,"search_banner":false,"search_grid":false,"rsa":{"before_pricing":true}}'::jsonb
  ),
  (
    'RSA_PREMIUM', 'Premium', 'Unlimited RSA for a full year with member discounts',
    9990, 12499, 365, true, 'RSA', true, 4,
    '20% OFF on all RSA services', 'RSA PREMIUM', '1 Year · Unlimited Service',
    'Valid 12 months · Unlimited RSA calls · 20% off towing & on-spot repairs',
    25000, 'VALUE', 'Total Benefits Value', 'You Save',
    'YOU PAY ONLY', 'Unlimited assists · One full year · One car',
    299, '2nd Car Add-On', 'Unlimited RSA for your second car too', 'car-sport',
    '#DC2626',
    '{"settings_page":true,"search_banner":false,"search_grid":false,"rsa":{"before_pricing":true}}'::jsonb
  ),
  (
    'RSA_ELITE', 'Elite', 'Premium yearly cover with priority response & extra assists',
    7990, 9999, 365, true, 'RSA', true, 5,
    'Priority dispatch · VIP support', 'RSA ELITE', '1 Year · 15 Services',
    'Valid 12 months · 15 RSA service calls · Fastest response priority',
    15000, 'VALUE', 'Total Benefits Value', 'You Save',
    'YOU PAY ONLY', '15 roadside assists · Priority line · One car',
    299, '2nd Car Add-On', 'Elite RSA benefits on a second car', 'car-sport',
    '#059669',
    '{"settings_page":true,"search_banner":false,"search_grid":false,"rsa":{"before_pricing":true}}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  duration_days = EXCLUDED.duration_days,
  active = EXCLUDED.active,
  membership_type = EXCLUDED.membership_type,
  app_visible = EXCLUDED.app_visible,
  display_order = EXCLUDED.display_order,
  tagline = EXCLUDED.tagline,
  badge = EXCLUDED.badge,
  period_label = EXCLUDED.period_label,
  footer_note = EXCLUDED.footer_note,
  total_benefits_value = EXCLUDED.total_benefits_value,
  value_column_label = EXCLUDED.value_column_label,
  total_benefits_label = EXCLUDED.total_benefits_label,
  save_label = EXCLUDED.save_label,
  price_hero_label = EXCLUDED.price_hero_label,
  price_hero_sub = EXCLUDED.price_hero_sub,
  second_car_addon_price = EXCLUDED.second_car_addon_price,
  second_car_addon_title = EXCLUDED.second_car_addon_title,
  second_car_addon_description = EXCLUDED.second_car_addon_description,
  second_car_addon_icon = EXCLUDED.second_car_addon_icon,
  accent_color = EXCLUDED.accent_color,
  app_placements = EXCLUDED.app_placements,
  updated_at = NOW();

-- Shared RSA benefits (same 5 points on every plan)
INSERT INTO public.membership_benefits (plan_id, benefit_code, title, description, icon, display_order, active)
SELECT p.id, v.benefit_code, v.title, v.description, v.icon, v.display_order, TRUE
FROM public.membership_plans p
CROSS JOIN (VALUES
  ('RSA_FLAT_TYRE', 'Flat tyre Assistance', 'Puncture fix or tyre change at your location', 'ellipse-outline', 1),
  ('RSA_BATTERY', 'Battery Jumpstart', 'Instant battery jumpstart wherever you are stranded', 'flash', 2),
  ('RSA_TOWING', 'Towing', 'Safe towing to the nearest MyFNG workshop', 'car', 3),
  ('RSA_MINOR_REPAIR', 'On spot minor repairs', 'Quick fixes to get you moving again', 'construct', 4),
  ('RSA_KEY_UNLOCK', 'Key Unlock Assistance', 'Help unlocking your vehicle if keys are misplaced', 'key', 5)
) AS v(benefit_code, title, description, icon, display_order)
WHERE p.code IN ('RSA_BASIC', 'RSA_FAMILY', 'RSA_PLUS', 'RSA_PREMIUM', 'RSA_ELITE')
  AND NOT EXISTS (
    SELECT 1 FROM public.membership_benefits b
    WHERE b.plan_id = p.id AND b.benefit_code = v.benefit_code
  );

UPDATE public.membership_benefits b SET
  title = v.title,
  description = v.description,
  icon = v.icon,
  display_order = v.display_order,
  active = TRUE,
  updated_at = NOW()
FROM public.membership_plans p,
(VALUES
  ('RSA_FLAT_TYRE', 'Flat tyre Assistance', 'Puncture fix or tyre change at your location', 'ellipse-outline', 1),
  ('RSA_BATTERY', 'Battery Jumpstart', 'Instant battery jumpstart wherever you are stranded', 'flash', 2),
  ('RSA_TOWING', 'Towing', 'Safe towing to the nearest MyFNG workshop', 'car', 3),
  ('RSA_MINOR_REPAIR', 'On spot minor repairs', 'Quick fixes to get you moving again', 'construct', 4),
  ('RSA_KEY_UNLOCK', 'Key Unlock Assistance', 'Help unlocking your vehicle if keys are misplaced', 'key', 5)
) AS v(benefit_code, title, description, icon, display_order)
WHERE b.plan_id = p.id
  AND p.code IN ('RSA_BASIC', 'RSA_FAMILY', 'RSA_PLUS', 'RSA_PREMIUM', 'RSA_ELITE')
  AND b.benefit_code = v.benefit_code;
