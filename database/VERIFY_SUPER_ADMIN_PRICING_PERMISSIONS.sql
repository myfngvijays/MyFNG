-- =====================================================
-- VERIFY SUPER ADMIN PRICING PERMISSIONS
-- Purpose: Test if Super Admin can add/edit/delete pricing
-- =====================================================

-- =====================================================
-- Step 1: Check Current User Role
-- =====================================================

-- Check if current user is Super Admin
SELECT 
  ul.id,
  ul.full_name,
  ul.email,
  r.role_code,
  r.role_name
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid()
  AND r.role_code = 'SUPER_ADMIN';

-- If no rows returned, current user is NOT Super Admin

-- =====================================================
-- Step 2: Check RLS Policies
-- =====================================================

-- View all policies on website_service_pricing table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'website_service_pricing'
ORDER BY policyname;

-- =====================================================
-- Step 3: Test INSERT Permission (Manual Test)
-- =====================================================

-- This will work ONLY if you're logged in as Super Admin
-- Replace the IDs with actual IDs from your database

/*
INSERT INTO public.website_service_pricing (
  zone_id,
  city_id,
  service_type_id,
  base_price,
  tax_rate,
  is_active,
  created_by
)
SELECT 
  (SELECT id FROM public.zones LIMIT 1),
  (SELECT id FROM public.cities LIMIT 1),
  (SELECT id FROM public.service_types LIMIT 1),
  500.00,
  18.00,
  true,
  auth.uid()
RETURNING *;
*/

-- =====================================================
-- Step 4: Test UPDATE Permission
-- =====================================================

/*
UPDATE public.website_service_pricing
SET 
  base_price = 600.00,
  updated_by = auth.uid(),
  updated_at = NOW()
WHERE id = (SELECT id FROM public.website_service_pricing LIMIT 1)
RETURNING *;
*/

-- =====================================================
-- Step 5: Test DELETE Permission
-- =====================================================

/*
DELETE FROM public.website_service_pricing
WHERE id = (SELECT id FROM public.website_service_pricing LIMIT 1)
RETURNING *;
*/

-- =====================================================
-- Step 6: Check All Super Admin Users
-- =====================================================

-- List all Super Admin users
SELECT 
  ul.id,
  ul.full_name,
  ul.email,
  ul.is_active,
  r.role_code,
  r.role_name
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE r.role_code = 'SUPER_ADMIN'
  AND ul.is_active = true
ORDER BY ul.full_name;

-- =====================================================
-- Step 7: Grant Direct Permissions (If RLS is blocking)
-- =====================================================

-- If RLS policies are not working, you can temporarily grant direct permissions
-- (Only use this if absolutely necessary, RLS should work)

/*
-- Grant permissions to Super Admin role (if using role-based auth)
GRANT ALL ON public.website_service_pricing TO authenticated;

-- Or grant to specific user
GRANT ALL ON public.website_service_pricing TO postgres;
*/

-- =====================================================
-- Step 8: Verify Table Structure
-- =====================================================

-- Check table columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'website_service_pricing'
ORDER BY ordinal_position;

-- =====================================================
-- Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Permission Verification Script Ready!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Steps to verify:';
  RAISE NOTICE '1. Check if current user is Super Admin';
  RAISE NOTICE '2. Check RLS policies are active';
  RAISE NOTICE '3. Test INSERT/UPDATE/DELETE (uncomment queries)';
  RAISE NOTICE '4. If issues, check Super Admin users list';
  RAISE NOTICE '========================================';
END $$;

