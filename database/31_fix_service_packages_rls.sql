-- =====================================================
-- FIX SERVICE_PACKAGES RLS POLICIES
-- Purpose: Ensure Super Admins can SELECT, INSERT, UPDATE, DELETE packages
-- =====================================================

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can view packages" ON public.service_packages;
DROP POLICY IF EXISTS "Everyone can view packages" ON public.service_packages;
DROP POLICY IF EXISTS "Super admins can manage packages" ON public.service_packages;

-- Create comprehensive Super Admin policy for ALL operations
CREATE POLICY "Super admins can manage packages" ON public.service_packages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Also allow authenticated users to VIEW packages (for other roles that might need to see them)
CREATE POLICY "Authenticated users can view packages" ON public.service_packages
FOR SELECT
USING (auth.role() = 'authenticated');

DO $$
BEGIN
    RAISE NOTICE '✅ Service Packages RLS Policies Fixed!';
END $$;

