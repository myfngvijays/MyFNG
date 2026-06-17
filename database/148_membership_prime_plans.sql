-- Add MyFNG Prime tier plans (marketing tiers for mobile app)
-- Run in Supabase SQL editor after 141_customer_profile_modules.sql

INSERT INTO public.membership_plans (code, name, description, price, duration_days, active)
VALUES
  ('PRIME', 'MyFNG Prime', '10% off services, 5% wallet cashback, free inspections & more', 699, 365, TRUE),
  ('PRIME_PLUS', 'MyFNG Prime Plus', 'Premium Prime tier with enhanced benefits', 1299, 365, FALSE),
  ('PRIME_ELITE', 'MyFNG Prime Elite', 'Top-tier membership — coming soon', 1999, 365, FALSE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days;
