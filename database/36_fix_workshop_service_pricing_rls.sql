-- =====================================================
-- FIX RLS POLICIES FOR WORKSHOP SERVICE PRICING
-- Purpose: Allow Super Admins to manage service pricing
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can manage service pricing" ON public.workshop_service_pricing;
DROP POLICY IF EXISTS "Authenticated users can view service pricing" ON public.workshop_service_pricing;
DROP POLICY IF EXISTS "Workshops can view their own pricing" ON public.workshop_service_pricing;

-- Policy: Super Admins can do everything
CREATE POLICY "Super admins can manage service pricing" ON public.workshop_service_pricing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Authenticated users can view (for reading prices)
CREATE POLICY "Authenticated users can view service pricing" ON public.workshop_service_pricing
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Workshop Admins can view their own workshop's pricing
CREATE POLICY "Workshops can view their own pricing" ON public.workshop_service_pricing
FOR SELECT
USING (
  workshop_id IN (
    SELECT workshop_id FROM users_login WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created for workshop_service_pricing!';
END $$;

