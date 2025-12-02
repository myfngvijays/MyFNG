-- =====================================================
-- ADD CLASS & ZONE TO WORKSHOP SERVICE PRICING
-- Purpose: Enable class-based and zone-based pricing for Service Types
-- =====================================================

-- 1. Add class column
ALTER TABLE public.workshop_service_pricing 
ADD COLUMN IF NOT EXISTS class VARCHAR(100);

-- 2. Add zone_id column
ALTER TABLE public.workshop_service_pricing 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id);

-- 3. Drop existing unique constraint (if exists)
ALTER TABLE public.workshop_service_pricing 
DROP CONSTRAINT IF EXISTS workshop_service_pricing_workshop_id_service_type_id_key;

-- 4. Drop existing unique index (if any)
DROP INDEX IF EXISTS idx_unique_workshop_service_pricing;

-- 5. Create new unique index with class and zone
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_workshop_service_class_zone 
ON public.workshop_service_pricing (
  workshop_id, 
  service_type_id, 
  COALESCE(class, 'DEFAULT'), 
  COALESCE(zone_id::text, 'DEFAULT')
);

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_class 
ON public.workshop_service_pricing(workshop_id, class);

CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_zone 
ON public.workshop_service_pricing(workshop_id, zone_id);

-- 7. Add comments
COMMENT ON COLUMN public.workshop_service_pricing.class IS 'Vehicle Class (e.g. SUV, Sedan). If NULL, applies to all classes.';
COMMENT ON COLUMN public.workshop_service_pricing.zone_id IS 'Zone ID. If NULL, applies to all zones.';

DO $$
BEGIN
    RAISE NOTICE '✅ Workshop Service Pricing updated with Class & Zone support!';
END $$;

