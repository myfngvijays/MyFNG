-- ============================================
-- Add Public/Anonymous Access for Booking Page
-- ============================================
-- This allows unauthenticated users to view cities, car models, 
-- service types, and pricing for the public booking page

-- 1. Cities - Allow anonymous users to view active cities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'cities' 
    AND policyname = 'Anonymous users can view active cities'
  ) THEN
    CREATE POLICY "Anonymous users can view active cities"
    ON public.cities
    FOR SELECT
    TO anon, public
    USING (is_active = true);
  END IF;
END $$;

-- 2. Car Models - Allow anonymous users to view active car models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'car_models' 
    AND policyname = 'Anonymous users can view active car models'
  ) THEN
    CREATE POLICY "Anonymous users can view active car models"
    ON public.car_models
    FOR SELECT
    TO anon, public
    USING (is_active = true);
  END IF;
END $$;

-- 3. Service Types - Allow anonymous users to view active service types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_types' 
    AND policyname = 'Anonymous users can view active service types'
  ) THEN
    CREATE POLICY "Anonymous users can view active service types"
    ON public.service_types
    FOR SELECT
    TO anon, public
    USING (is_active = true);
  END IF;
END $$;

-- 4. Workshop Service Pricing - Allow anonymous users to view pricing
-- (This is needed for the booking page to show service prices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workshop_service_pricing' 
    AND policyname = 'Anonymous users can view service pricing'
  ) THEN
    CREATE POLICY "Anonymous users can view service pricing"
    ON public.workshop_service_pricing
    FOR SELECT
    TO anon, public
    USING (is_active = true);
  END IF;
END $$;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('cities', 'car_models', 'service_types', 'workshop_service_pricing')
  AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
ORDER BY tablename, policyname;

COMMENT ON POLICY "Anonymous users can view active cities" ON public.cities IS 
'Allows unauthenticated users to view active cities for the public booking page';

COMMENT ON POLICY "Anonymous users can view active car models" ON public.car_models IS 
'Allows unauthenticated users to view active car models for the public booking page';

COMMENT ON POLICY "Anonymous users can view active service types" ON public.service_types IS 
'Allows unauthenticated users to view active service types for the public booking page';

COMMENT ON POLICY "Anonymous users can view service pricing" ON public.workshop_service_pricing IS 
'Allows unauthenticated users to view service pricing for the public booking page';
