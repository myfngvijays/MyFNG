-- =====================================================
-- ENSURE PACKAGES ACCESS & DATA
-- Purpose: Fix visibility issues and ensure at least one package exists
-- =====================================================

-- 1. Allow Authenticated users to VIEW packages (Fix visibility)
DROP POLICY IF EXISTS "Authenticated users can view packages" ON public.service_packages;
CREATE POLICY "Authenticated users can view packages" ON public.service_packages
FOR SELECT
USING (auth.role() = 'authenticated');

-- 2. Ensure Super Admin has FULL access
DROP POLICY IF EXISTS "Super admins can manage packages" ON public.service_packages;
CREATE POLICY "Super admins can manage packages" ON public.service_packages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- 3. Insert a Test Package (Only if table is empty)
INSERT INTO public.service_packages (name, description, total_price, tax_rate, is_active)
SELECT 'System Test Package', 'Auto-generated to verify visibility', 100.00, 18.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.service_packages);

-- 4. Verify Data
DO $$
DECLARE
    pkg_count integer;
BEGIN
    SELECT count(*) INTO pkg_count FROM public.service_packages;
    RAISE NOTICE 'Total Packages in Database: %', pkg_count;
END $$;

