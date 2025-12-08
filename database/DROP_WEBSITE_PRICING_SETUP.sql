-- =====================================================
-- DROP WEBSITE PRICING SETUP - ROLLBACK SCRIPT
-- Purpose: Remove all website pricing related changes
-- =====================================================

-- =====================================================
-- Step 1: Drop Views
-- =====================================================

DROP VIEW IF EXISTS public.website_pricing_view CASCADE;

-- =====================================================
-- Step 2: Drop Functions
-- =====================================================

DROP FUNCTION IF EXISTS public.get_website_service_price(
  p_zone_id UUID,
  p_city_id UUID,
  p_service_type_id UUID,
  p_vehicle_class VARCHAR
) CASCADE;

DROP FUNCTION IF EXISTS public.update_website_pricing_updated_at() CASCADE;

-- =====================================================
-- Step 3: Drop Triggers (only if table exists)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'website_service_pricing'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_update_website_pricing_updated_at 
        ON public.website_service_pricing;
        RAISE NOTICE '✅ Dropped trigger';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist, skipping trigger drop';
    END IF;
END $$;

-- =====================================================
-- Step 4: Drop RLS Policies (only if table exists)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'website_service_pricing'
    ) THEN
        DROP POLICY IF EXISTS "Everyone can view active website pricing" 
        ON public.website_service_pricing;

        DROP POLICY IF EXISTS "Authenticated users can view all pricing" 
        ON public.website_service_pricing;

        DROP POLICY IF EXISTS "Super Admin can manage website pricing" 
        ON public.website_service_pricing;

        DROP POLICY IF EXISTS "Super Admin can insert pricing" 
        ON public.website_service_pricing;

        DROP POLICY IF EXISTS "Super Admin can update pricing" 
        ON public.website_service_pricing;

        DROP POLICY IF EXISTS "Super Admin can delete pricing" 
        ON public.website_service_pricing;
        
        RAISE NOTICE '✅ Dropped all RLS policies';
    ELSE
        RAISE NOTICE 'ℹ️  Table does not exist, skipping policy drops';
    END IF;
END $$;

-- =====================================================
-- Step 5: Drop Indexes
-- =====================================================

DROP INDEX IF EXISTS public.idx_website_pricing_zone;
DROP INDEX IF EXISTS public.idx_website_pricing_city;
DROP INDEX IF EXISTS public.idx_website_pricing_service;
DROP INDEX IF EXISTS public.idx_website_pricing_zone_city;
DROP INDEX IF EXISTS public.idx_website_pricing_active;
DROP INDEX IF EXISTS public.idx_website_pricing_class;
DROP INDEX IF EXISTS public.idx_unique_website_pricing;

-- =====================================================
-- Step 6: Drop Table
-- =====================================================

DROP TABLE IF EXISTS public.website_service_pricing CASCADE;

-- =====================================================
-- Step 7: Remove zone_id from cities (if added)
-- =====================================================

-- Check if zone_id column exists and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cities' 
        AND column_name = 'zone_id'
    ) THEN
        -- Drop index first
        DROP INDEX IF EXISTS public.idx_cities_zone_id;
        
        -- Drop foreign key constraint if exists
        ALTER TABLE public.cities 
        DROP CONSTRAINT IF EXISTS cities_zone_id_fkey;
        
        -- Drop column
        ALTER TABLE public.cities 
        DROP COLUMN IF EXISTS zone_id;
        
        RAISE NOTICE '✅ Dropped zone_id column from cities table';
    ELSE
        RAISE NOTICE 'ℹ️  zone_id column does not exist in cities table';
    END IF;
END $$;

-- =====================================================
-- Step 8: Remove Comments (if any)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'website_service_pricing'
    ) THEN
        COMMENT ON TABLE public.website_service_pricing IS NULL;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cities' 
        AND column_name = 'zone_id'
    ) THEN
        COMMENT ON COLUMN public.cities.zone_id IS NULL;
    END IF;
END $$;

-- =====================================================
-- Success Notification
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Website Pricing Setup Dropped!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Removed:';
  RAISE NOTICE '- website_service_pricing table';
  RAISE NOTICE '- website_pricing_view';
  RAISE NOTICE '- get_website_service_price() function';
  RAISE NOTICE '- All RLS policies';
  RAISE NOTICE '- All indexes';
  RAISE NOTICE '- zone_id from cities (if existed)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All changes have been rolled back!';
  RAISE NOTICE '========================================';
END $$;
