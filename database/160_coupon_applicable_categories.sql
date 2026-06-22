-- Add category-level coupon targeting (Periodic Service, AC Service, etc.)
-- Run after 159_coupon_types.sql

BEGIN;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS applicable_category_ids JSONB;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 160 applied: coupons.applicable_category_ids';
END $$;
