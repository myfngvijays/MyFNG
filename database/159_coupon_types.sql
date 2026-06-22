-- Coupon marketing/display types (Welcome, Flat Discount, Scratch Card, etc.)
-- Run after 156_coupon_management_enhancements.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.coupon_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS coupon_type_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_coupons_type_slug ON public.coupons (coupon_type_slug);

INSERT INTO public.coupon_types (slug, label, is_system, display_order) VALUES
  ('welcome', 'Welcome Coupon', true, 1),
  ('flat', 'Flat Discount', true, 2),
  ('percent', 'Percentage Discount', true, 3),
  ('free_service', 'Free Service', true, 4),
  ('bundle', 'Bundle Offer', true, 5),
  ('free_checkup', 'Free Checkup', true, 6),
  ('referral', 'Referral Coupon', true, 7),
  ('society', 'Society Coupon', true, 8),
  ('festival', 'Festival Coupon', true, 9),
  ('corporate', 'Corporate Coupon', true, 10),
  ('loyalty', 'Loyalty Coupon', true, 11),
  ('cashback', 'Cashback Coupon', true, 12),
  ('scratch', 'Scratch Card', true, 13)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.coupon_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_types'
      AND policyname = 'Super admins can manage coupon_types'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_types"
      ON public.coupon_types FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 159 applied: coupon_types table + coupons.coupon_type_slug';
END $$;
