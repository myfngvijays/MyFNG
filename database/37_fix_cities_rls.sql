-- =====================================================
-- FIX RLS POLICIES FOR CITIES TABLE
-- Purpose: Allow authenticated users to view cities
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view cities" ON public.cities;
DROP POLICY IF EXISTS "Everyone can view cities" ON public.cities;

-- Policy: Authenticated users can view active cities
CREATE POLICY "Authenticated users can view cities" ON public.cities
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Policy: Super Admins can manage cities
CREATE POLICY "Super admins can manage cities" ON public.cities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created for cities table!';
END $$;

