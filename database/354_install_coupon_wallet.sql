-- First-login / install coupon → extra welcome wallet credit
-- Festival / society codes add to the ₹1000 welcome bonus (same wallet rules).

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS install_coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS install_coupon_type TEXT,
  ADD COLUMN IF NOT EXISTS society_code TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_install_coupon_code
  ON public.customers (install_coupon_code)
  WHERE install_coupon_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_society_code
  ON public.customers (society_code)
  WHERE society_code IS NOT NULL;

INSERT INTO public.coupon_types (slug, label, is_system, display_order) VALUES
  ('festival', 'Festival Coupon', true, 9),
  ('society', 'Society Coupon', true, 8)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '354 applied: customers.install_coupon_code / society_code for first-login wallet coupons';
END $$;
