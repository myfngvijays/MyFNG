-- =====================================================
-- ADD ZONE_ID TO CITIES TABLE
-- Purpose: Link cities to zones for pricing management
-- =====================================================

-- =====================================================
-- Step 1: Add zone_id column
-- =====================================================
ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id);

-- =====================================================
-- Step 2: Create index for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cities_zone_id ON public.cities(zone_id);

-- =====================================================
-- Step 3: Add comment
-- =====================================================
COMMENT ON COLUMN public.cities.zone_id IS 'Zone reference - links city to a zone for pricing and management';

-- =====================================================
-- Step 4: Optional - Update existing cities if needed
-- =====================================================
-- Uncomment and update if you want to assign existing cities to zones
-- Example:
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'North Zone') WHERE name IN ('Delhi', 'Noida', 'Gurgaon');

-- =====================================================
-- Success Notification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ zone_id column added to cities table!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Column: zone_id (UUID, FK to zones)';
  RAISE NOTICE 'Index: idx_cities_zone_id';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Use Zones page to map cities to zones';
  RAISE NOTICE '2. Or run UPDATE queries to assign cities';
  RAISE NOTICE '========================================';
END $$;
