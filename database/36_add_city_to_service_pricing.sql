-- =====================================================
-- ADD CITY TO WORKSHOP SERVICE PRICING
-- Purpose: Enable city-based pricing in addition to zone and class
-- Structure: zone_id + city_id + class + service_type_id
-- =====================================================

-- =====================================================
-- Step 1: Add city_id column
-- =====================================================
ALTER TABLE public.workshop_service_pricing 
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);

-- =====================================================
-- Step 2: Drop existing unique constraint/index
-- =====================================================
-- Drop old unique index if exists
DROP INDEX IF EXISTS idx_unique_workshop_service_class_zone;

-- Drop old unique constraint if exists
ALTER TABLE public.workshop_service_pricing 
DROP CONSTRAINT IF EXISTS workshop_service_pricing_workshop_id_service_type_id_key;

-- =====================================================
-- Step 3: Create new unique index with city
-- =====================================================
-- New unique constraint: workshop + service + zone + city + class
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_workshop_service_zone_city_class 
ON public.workshop_service_pricing (
  workshop_id, 
  service_type_id, 
  COALESCE(zone_id::text, 'DEFAULT'), 
  COALESCE(city_id::text, 'DEFAULT'),
  COALESCE(class, 'DEFAULT')
);

-- =====================================================
-- Step 4: Add performance indexes
-- =====================================================
-- Index for city lookups
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_city 
ON public.workshop_service_pricing(workshop_id, city_id);

-- Index for zone + city combination
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_zone_city 
ON public.workshop_service_pricing(workshop_id, zone_id, city_id);

-- Index for class + city combination
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_class_city 
ON public.workshop_service_pricing(workshop_id, class, city_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_zone_city_class 
ON public.workshop_service_pricing(workshop_id, zone_id, city_id, class);

-- =====================================================
-- Step 5: Add comments
-- =====================================================
COMMENT ON COLUMN public.workshop_service_pricing.city_id IS 'City ID. If NULL, applies to all cities in the zone. More specific than zone_id.';
COMMENT ON COLUMN public.workshop_service_pricing.zone_id IS 'Zone ID. If NULL, applies to all zones.';
COMMENT ON COLUMN public.workshop_service_pricing.class IS 'Vehicle Class (e.g. SUV, Sedan). If NULL, applies to all classes.';

-- =====================================================
-- Step 6: Update table comment
-- =====================================================
COMMENT ON TABLE public.workshop_service_pricing IS 'Workshop-specific pricing for service types. Supports zone, city, and vehicle class-based pricing. Priority: city > zone > default.';

-- =====================================================
-- Success Notification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ City Support Added to Workshop Service Pricing!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New Structure:';
  RAISE NOTICE '- workshop_id';
  RAISE NOTICE '- service_type_id';
  RAISE NOTICE '- zone_id (optional)';
  RAISE NOTICE '- city_id (optional) ← NEW';
  RAISE NOTICE '- class (optional)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Pricing Priority:';
  RAISE NOTICE '1. Most Specific: city_id + class';
  RAISE NOTICE '2. Zone Level: zone_id + class';
  RAISE NOTICE '3. Default: No zone/city/class';
  RAISE NOTICE '========================================';
END $$;
