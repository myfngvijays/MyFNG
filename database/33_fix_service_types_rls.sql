-- =====================================================
-- FIX SERVICE_TYPES RLS POLICIES
-- Purpose: Ensure Service Types are visible to authenticated users
-- =====================================================

-- 1. Allow Authenticated users to VIEW service types
DROP POLICY IF EXISTS "Authenticated users can view service types" ON public.service_types;
CREATE POLICY "Authenticated users can view service types" ON public.service_types
FOR SELECT
USING (auth.role() = 'authenticated');

-- 2. Allow Super Admins to MANAGE service types
DROP POLICY IF EXISTS "Super admins can manage service types" ON public.service_types;
CREATE POLICY "Super admins can manage service types" ON public.service_types
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ Service Types RLS Policies Fixed!';
END $$;

