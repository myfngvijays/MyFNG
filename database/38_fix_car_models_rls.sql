-- =====================================================
-- FIX RLS POLICIES FOR CAR_MODELS TABLE
-- Purpose: Allow authenticated users to view car models
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.car_models ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view car models" ON public.car_models;
DROP POLICY IF EXISTS "Everyone can view car models" ON public.car_models;
DROP POLICY IF EXISTS "Super admins can manage car models" ON public.car_models;

-- Policy: Authenticated users can view active car models
CREATE POLICY "Authenticated users can view car models" ON public.car_models
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Policy: Super Admins can manage car models
CREATE POLICY "Super admins can manage car models" ON public.car_models
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
    RAISE NOTICE '✅ RLS policies created for car_models table!';
END $$;

