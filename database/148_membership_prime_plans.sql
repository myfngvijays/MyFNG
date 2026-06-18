-- MyFNG Prime — single active membership tier at launch
-- Run in Supabase SQL editor after 141_customer_profile_modules.sql
-- Additional tiers: create later from Super Admin → Membership Plans → Add Plan

INSERT INTO public.membership_plans (code, name, description, price, duration_days, active)
VALUES
  ('PRIME', 'MyFNG Prime', '10% off services, 5% wallet cashback, free inspections & more', 699, 365, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days,
  active = TRUE;

-- Hide draft tiers if an older migration already inserted them
UPDATE public.membership_plans
SET active = FALSE, updated_at = NOW()
WHERE code IN ('PRIME_PLUS', 'PRIME_ELITE');
