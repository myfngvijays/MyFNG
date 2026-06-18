-- Value-card CMS fields (pricing band, benefit values, Flaticon classes)
-- Run after 149_membership_admin.sql

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS total_benefits_value NUMERIC(12,2) DEFAULT 6650,
  ADD COLUMN IF NOT EXISTS value_column_label VARCHAR(30) DEFAULT 'VALUE',
  ADD COLUMN IF NOT EXISTS total_benefits_label VARCHAR(80) DEFAULT 'Total Benefits Value',
  ADD COLUMN IF NOT EXISTS save_label VARCHAR(40) DEFAULT 'You Save',
  ADD COLUMN IF NOT EXISTS price_hero_label VARCHAR(60) DEFAULT 'YOU PAY ONLY',
  ADD COLUMN IF NOT EXISTS price_hero_sub TEXT DEFAULT 'All benefits · One full year · One car',
  ADD COLUMN IF NOT EXISTS second_car_addon_icon_class VARCHAR(120),
  ADD COLUMN IF NOT EXISTS second_car_addon_icon_url TEXT;

ALTER TABLE public.membership_benefits
  ADD COLUMN IF NOT EXISTS value_label VARCHAR(40),
  ADD COLUMN IF NOT EXISTS value_prefix VARCHAR(30),
  ADD COLUMN IF NOT EXISTS icon_class VARCHAR(120);

UPDATE public.membership_plans SET
  total_benefits_value = 6650,
  value_column_label = 'VALUE',
  total_benefits_label = 'Total Benefits Value',
  save_label = 'You Save',
  price_hero_label = 'YOU PAY ONLY',
  price_hero_sub = 'All benefits · One full year · One car',
  price = 699,
  original_price = 999,
  tagline = 'Your Car. Our Responsibility.',
  period_label = '/ year',
  footer_note = 'Valid 12 months from activation · Linked to registered mobile number · Free pickup & drop included as standard',
  second_car_addon_price = 299,
  second_car_addon_title = '2nd Car Add-On',
  second_car_addon_description = 'Same benefits, same membership period as primary car',
  second_car_addon_icon = 'car-sport',
  display_order = 1,
  active = TRUE
WHERE code = 'PRIME';

-- Ensure all 8 flyer benefits exist (safe if 149 was skipped or partial)
INSERT INTO public.membership_benefits (plan_id, benefit_code, title, description, icon, value_prefix, value_label, display_order, active)
SELECT p.id, v.benefit_code, v.title, v.description, v.icon, v.value_prefix, v.value_label, v.display_order, TRUE
FROM public.membership_plans p
CROSS JOIN (VALUES
  ('PERIODIC_10_OFF', '10% Off Periodic Packages', 'On every scheduled service, all year', 'pricetag', 'Up to', '₹1,000', 1),
  ('CASHBACK_5', '5% Cashback to Wallet', 'On every bill, all year, auto-credited', 'cash', NULL, '₹500', 2),
  ('FREE_INSPECTION', 'Free Top-Up & Inspection (2x)', 'Fluids, tyre pressure, visual check', 'construct', NULL, '₹1,200', 3),
  ('FREE_SCAN', 'Free Car Scanning (2x)', 'Full computerised diagnostic', 'pulse', NULL, '₹1,200', 4),
  ('DAMAGE_ASSESS', 'Free Insurance Claim Help', 'We assess, document & handle your claim', 'shield-checkmark', NULL, '₹1,000', 5),
  ('WHATSAPP_GROUP', 'Prime Personal WhatsApp Group', 'Senior technical advisor for all your car needs', 'logo-whatsapp', NULL, '₹500', 6),
  ('PRIORITY_BOOKING', 'Priority Slot Booking', 'First pick on every slot, skip the wait', 'flash', NULL, '₹500', 7),
  ('EXTENDED_WARRANTY', '6-Month Extended Warranty', '6x our standard coverage on every service', 'ribbon', NULL, '₹500', 8)
) AS v(benefit_code, title, description, icon, value_prefix, value_label, display_order)
WHERE p.code = 'PRIME'
  AND NOT EXISTS (
    SELECT 1 FROM public.membership_benefits b WHERE b.plan_id = p.id AND b.benefit_code = v.benefit_code
  );

UPDATE public.membership_benefits b SET
  title = v.title,
  description = v.description,
  icon = v.icon,
  value_prefix = v.value_prefix,
  value_label = v.value_label,
  display_order = v.display_order,
  active = TRUE
FROM public.membership_plans p,
(VALUES
  ('PERIODIC_10_OFF', '10% Off Periodic Packages', 'On every scheduled service, all year', 'pricetag', 'Up to', '₹1,000', 1),
  ('CASHBACK_5', '5% Cashback to Wallet', 'On every bill, all year, auto-credited', 'cash', NULL, '₹500', 2),
  ('FREE_INSPECTION', 'Free Top-Up & Inspection (2x)', 'Fluids, tyre pressure, visual check', 'construct', NULL, '₹1,200', 3),
  ('FREE_SCAN', 'Free Car Scanning (2x)', 'Full computerised diagnostic', 'pulse', NULL, '₹1,200', 4),
  ('DAMAGE_ASSESS', 'Free Insurance Claim Help', 'We assess, document & handle your claim', 'shield-checkmark', NULL, '₹1,000', 5),
  ('WHATSAPP_GROUP', 'Prime Personal WhatsApp Group', 'Senior technical advisor for all your car needs', 'logo-whatsapp', NULL, '₹500', 6),
  ('PRIORITY_BOOKING', 'Priority Slot Booking', 'First pick on every slot, skip the wait', 'flash', NULL, '₹500', 7),
  ('EXTENDED_WARRANTY', '6-Month Extended Warranty', '6x our standard coverage on every service', 'ribbon', NULL, '₹500', 8)
) AS v(benefit_code, title, description, icon, value_prefix, value_label, display_order)
WHERE b.plan_id = p.id AND p.code = 'PRIME' AND b.benefit_code = v.benefit_code;

-- Re-order all PRIME benefits
UPDATE public.membership_benefits b SET display_order = v.display_order
FROM public.membership_plans p,
(VALUES
  ('PERIODIC_10_OFF', 1),
  ('CASHBACK_5', 2),
  ('FREE_INSPECTION', 3),
  ('FREE_SCAN', 4),
  ('DAMAGE_ASSESS', 5),
  ('WHATSAPP_GROUP', 6),
  ('PRIORITY_BOOKING', 7),
  ('EXTENDED_WARRANTY', 8)
) AS v(benefit_code, display_order)
WHERE b.plan_id = p.id AND p.code = 'PRIME' AND b.benefit_code = v.benefit_code;

-- Only PRIME is active at launch; extra tiers come from admin panel later
UPDATE public.membership_plans
SET active = FALSE, updated_at = NOW()
WHERE code IN ('PRIME_PLUS', 'PRIME_ELITE', 'BRONZE', 'SILVER', 'GOLD');
