-- Percentage caps grouped by car class.
-- {"rules":[{"classes":["HATCHBACK","COMPACT SUV"],"cap":1000},{"classes":["SUV/MUVs"],"cap":2000}]}

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS class_discount_caps JSONB;

COMMENT ON COLUMN public.coupons.class_discount_caps IS
  'Optional percent-coupon caps by car class: {"rules":[{"classes":["HATCHBACK"],"cap":1000}]}.';
