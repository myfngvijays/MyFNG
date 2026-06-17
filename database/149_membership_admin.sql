-- Membership admin CMS fields (plans, benefits, second-car addon)
-- Run after 141_customer_profile_modules.sql and 148_membership_prime_plans.sql

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(200),
  ADD COLUMN IF NOT EXISTS badge VARCHAR(50) DEFAULT 'MEMBERSHIP',
  ADD COLUMN IF NOT EXISTS period_label VARCHAR(30) DEFAULT '/ Year',
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS footer_note TEXT,
  ADD COLUMN IF NOT EXISTS second_car_addon_price NUMERIC(12,2) DEFAULT 299,
  ADD COLUMN IF NOT EXISTS second_car_addon_title VARCHAR(120) DEFAULT '2nd Car Add-On',
  ADD COLUMN IF NOT EXISTS second_car_addon_description TEXT,
  ADD COLUMN IF NOT EXISTS second_car_addon_icon VARCHAR(50) DEFAULT 'car-sport';

ALTER TABLE public.membership_benefits
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50),
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.customer_memberships
  ADD COLUMN IF NOT EXISTS has_second_car BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.membership_plans SET
  original_price = 999,
  tagline = 'Your Car. Our Responsibility.',
  badge = 'MEMBERSHIP',
  period_label = '/ Year',
  display_order = 1,
  footer_note = 'Valid 12 months from activation · Linked to registered mobile number',
  second_car_addon_price = 299,
  second_car_addon_title = '2nd Car Add-On',
  second_car_addon_description = 'Cover your family''s second car — same benefits',
  second_car_addon_icon = 'car-sport'
WHERE code = 'PRIME';

-- Seed PRIME benefits (skip if already present)
INSERT INTO public.membership_benefits (plan_id, benefit_code, title, description, icon, display_order, active)
SELECT p.id, v.benefit_code, v.title, v.description, v.icon, v.display_order, TRUE
FROM public.membership_plans p
CROSS JOIN (VALUES
  ('PERIODIC_10_OFF', '10% Off Periodic Packages', 'Save on every scheduled service, all year', 'pricetag', 1),
  ('CASHBACK_5', '5% Cashback to Wallet', 'On every MY FNG bill, automatically credited', 'cash', 2),
  ('FREE_INSPECTION', 'Free Top-Up & Inspection', '2 times a year — fluids, tyre pressure, visual check', 'construct', 3),
  ('FREE_SCAN', 'Free Car Scanning', '2 full diagnostic scans — know your car''s health', 'pulse', 4),
  ('DAMAGE_ASSESS', 'Free Damage Assessment & Insurance Claim', 'Accident or dent? We assess, document & handle your insurance claim end-to-end', 'shield-checkmark', 5),
  ('PRIORITY_BOOKING', 'Priority Slot Booking', 'Members get first pick — skip the wait', 'flash', 6),
  ('EXTENDED_WARRANTY', '6-Month Extended Warranty', '6x our standard coverage on every service', 'ribbon', 7)
) AS v(benefit_code, title, description, icon, display_order)
WHERE p.code = 'PRIME'
  AND NOT EXISTS (
    SELECT 1 FROM public.membership_benefits b WHERE b.plan_id = p.id AND b.benefit_code = v.benefit_code
  );
