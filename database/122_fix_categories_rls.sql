-- =====================================================
-- FIX CATEGORIES RLS (SUPER_ADMIN)
-- Purpose: Allow SUPER_ADMIN to INSERT/UPDATE/DELETE categories
--          and all authenticated users to SELECT.
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Super admins can manage categories" ON public.categories;

-- Allow all authenticated users to read categories
CREATE POLICY "Anyone can view categories" ON public.categories
FOR SELECT
USING (true);

-- Allow SUPER_ADMIN to insert/update/delete
CREATE POLICY "Super admins can manage categories" ON public.categories
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

DO $$
BEGIN
    RAISE NOTICE '✅ Categories RLS fixed (SUPER_ADMIN can manage, all can read)!';
END $$;
