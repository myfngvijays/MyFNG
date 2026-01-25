-- =====================================================
-- FIX SERVICE_TYPES INSERT RLS (SUPER_ADMIN)
-- Purpose: INSERT requires a WITH CHECK clause; without it,
--          Postgres rejects new rows even if USING() passes.
-- =====================================================

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE IF EXISTS public.service_types ENABLE ROW LEVEL SECURITY;

-- Recreate Super Admin manage policy with BOTH USING + WITH CHECK
DROP POLICY IF EXISTS "Super admins can manage service types" ON public.service_types;
CREATE POLICY "Super admins can manage service types" ON public.service_types
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
    RAISE NOTICE '✅ Service Types INSERT RLS fixed (SUPER_ADMIN can INSERT)!';
END $$;

