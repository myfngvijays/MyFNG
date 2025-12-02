-- =====================================================
-- ADD ZONE TO WORKSHOP PRODUCT PRICING
-- Purpose: Enable zone-based pricing for Products (class already exists)
-- =====================================================

-- 1. Add zone_id column
ALTER TABLE public.workshop_product_pricing 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id);

-- 2. Drop existing unique index (from migration 30)
DROP INDEX IF EXISTS idx_unique_workshop_product_class;

-- 3. Create new unique index with class and zone
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_workshop_product_class_zone 
ON public.workshop_product_pricing (
  workshop_id, 
  product_id, 
  COALESCE(class, 'DEFAULT'), 
  COALESCE(zone_id::text, 'DEFAULT')
);

-- 4. Add performance index for zone
CREATE INDEX IF NOT EXISTS idx_workshop_product_pricing_zone 
ON public.workshop_product_pricing(workshop_id, zone_id);

-- 5. Add comment
COMMENT ON COLUMN public.workshop_product_pricing.zone_id IS 'Zone ID. If NULL, applies to all zones.';

DO $$
BEGIN
    RAISE NOTICE '✅ Workshop Product Pricing updated with Zone support!';
END $$;

