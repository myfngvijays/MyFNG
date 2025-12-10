-- ============================================
-- Fix Public Access for Book Service Page
-- ============================================
-- This ensures service_types table is accessible to anonymous users
-- for the public booking page

-- Step 1: Enable RLS on service_types (if not already enabled)
ALTER TABLE IF EXISTS public.service_types ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anonymous users can view active service types" ON public.service_types;
DROP POLICY IF EXISTS "Authenticated users can view service types" ON public.service_types;
DROP POLICY IF EXISTS "Super admins can manage service types" ON public.service_types;

-- Step 3: Create public access policy for service_types
CREATE POLICY "Anonymous users can view active service types"
ON public.service_types
FOR SELECT
TO anon, authenticated, public
USING (is_active = true);

-- Step 4: Ensure RLS is enabled on workshop_service_pricing
ALTER TABLE IF EXISTS public.workshop_service_pricing ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop and recreate pricing policy
DROP POLICY IF EXISTS "Anonymous users can view service pricing" ON public.workshop_service_pricing;
DROP POLICY IF EXISTS "Public can view service pricing" ON public.workshop_service_pricing;

CREATE POLICY "Anonymous users can view service pricing"
ON public.workshop_service_pricing
FOR SELECT
TO anon, authenticated, public
USING (is_active = true);

-- Step 6: Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'service_types'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on service_types table';
  END IF;
END $$;

-- Step 7: Verify policies exist
SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('service_types', 'workshop_service_pricing')
  AND (policyname LIKE '%anonymous%' OR policyname LIKE '%public%' OR 'anon' = ANY(roles) OR 'public' = ANY(roles))
ORDER BY tablename, policyname;

-- Step 8: Test query (should work for anonymous users)
-- This simulates what the booking page does
SELECT 
  id, 
  name, 
  description,
  is_active,
  created_at
FROM public.service_types
WHERE is_active = true
ORDER BY name
LIMIT 10;
