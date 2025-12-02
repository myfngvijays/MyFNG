-- =====================================================
-- FIX RLS POLICIES FOR SERVICE_ADDONS AND SERVICE_LEADS
-- Purpose: Allow telecallers to view addons and create leads
-- =====================================================

-- =====================================================
-- 1. SERVICE_ADDONS TABLE
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_addons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view service addons" ON public.service_addons;
DROP POLICY IF EXISTS "Everyone can view service addons" ON public.service_addons;
DROP POLICY IF EXISTS "Super admins can manage service addons" ON public.service_addons;

-- Policy: Authenticated users can view active service addons
CREATE POLICY "Authenticated users can view service addons" ON public.service_addons
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Policy: Super Admins can manage service addons
CREATE POLICY "Super admins can manage service addons" ON public.service_addons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 2. SERVICE_LEADS TABLE - TELECALLER INSERT PERMISSION
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing telecaller insert policy if any
DROP POLICY IF EXISTS "Telecallers can insert leads" ON public.service_leads;
DROP POLICY IF EXISTS "Telecallers can create leads" ON public.service_leads;

-- Policy: Telecallers can insert leads (create new leads)
CREATE POLICY "Telecallers can insert leads" ON public.service_leads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('TELECALLER', 'SUPER_ADMIN', 'LEAD_MANAGER')
  )
  AND (
    -- Telecaller can only set themselves as assigned_telecaller_id
    assigned_telecaller_id = auth.uid()
    OR assigned_telecaller_id IS NULL
  )
);

-- Policy: Telecallers can view their own leads
CREATE POLICY "Telecallers can view their leads" ON public.service_leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND (
      r.role_code IN ('TELECALLER', 'SUPER_ADMIN', 'LEAD_MANAGER', 'CSE')
      OR (r.role_code = 'TELECALLER' AND assigned_telecaller_id = auth.uid())
    )
  )
);

-- Policy: Telecallers can update their own leads
CREATE POLICY "Telecallers can update their leads" ON public.service_leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('TELECALLER', 'SUPER_ADMIN', 'LEAD_MANAGER')
  )
  AND (
    assigned_telecaller_id = auth.uid()
    OR created_by_id = auth.uid()
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created for service_addons and service_leads!';
    RAISE NOTICE '✅ Telecallers can now view addons and create leads!';
END $$;

