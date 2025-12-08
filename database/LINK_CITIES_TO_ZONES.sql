-- =====================================================
-- LINK CITIES TO ZONES
-- Purpose: Add zone_id to cities table for better organization
-- =====================================================

-- Add zone_id column to cities table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cities' AND column_name = 'zone_id'
    ) THEN
        ALTER TABLE public.cities 
        ADD COLUMN zone_id UUID REFERENCES public.zones(id);
        
        RAISE NOTICE '✅ Added zone_id column to cities table';
    ELSE
        RAISE NOTICE 'ℹ️  zone_id column already exists in cities table';
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cities_zone_id ON public.cities(zone_id);

-- Add comment
COMMENT ON COLUMN public.cities.zone_id IS 'Zone reference - links city to a zone for pricing and management';

-- =====================================================
-- Sample: Link some cities to zones (update as needed)
-- =====================================================
-- Example queries to link cities:
-- 
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'North Zone') WHERE name IN ('Delhi', 'Noida', 'Gurgaon');
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'South Zone') WHERE name IN ('Bangalore', 'Chennai', 'Hyderabad');
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'West Zone') WHERE name IN ('Mumbai', 'Pune', 'Ahmedabad');
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'East Zone') WHERE name IN ('Kolkata', 'Bhubaneswar');
-- UPDATE public.cities SET zone_id = (SELECT id FROM public.zones WHERE name = 'Metro Cities') WHERE name IN ('Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad');

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Cities-Zones linking setup complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Update cities with zone_id using:';
  RAISE NOTICE 'UPDATE cities SET zone_id = <zone_uuid> WHERE name = ''<city_name>'';';
  RAISE NOTICE '========================================';
END $$;

