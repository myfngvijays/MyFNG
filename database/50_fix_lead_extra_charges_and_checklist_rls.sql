-- =====================================================
-- FIX RLS POLICIES FOR lead_extra_charges AND service_checklists
-- Purpose: Allow mechanics to insert extra work requests and view their checklists
-- Date: 2025-12-02
-- =====================================================

-- =====================================================
-- LEAD_EXTRA_CHARGES TABLE - MECHANIC POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_extra_charges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Mechanics can insert extra work requests" ON public.lead_extra_charges;
DROP POLICY IF EXISTS "Mechanics can view their extra work requests" ON public.lead_extra_charges;
DROP POLICY IF EXISTS "Workshop admins can manage extra charges" ON public.lead_extra_charges;
DROP POLICY IF EXISTS "Super admins can manage all extra charges" ON public.lead_extra_charges;

-- Policy: Mechanics can insert extra work requests for their assigned jobs
CREATE POLICY "Mechanics can insert extra work requests" ON public.lead_extra_charges
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE mj.lead_id = lead_extra_charges.lead_id
    AND mj.mechanic_id = auth.uid()
    AND r.role_code = 'WORKSHOP_MECHANIC'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Mechanics can view their own extra work requests
CREATE POLICY "Mechanics can view their extra work requests" ON public.lead_extra_charges
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = lead_extra_charges.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Workshop admins and supervisors can manage extra charges for their workshop
CREATE POLICY "Workshop admins can manage extra charges" ON public.lead_extra_charges
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Super admins can manage all extra charges
CREATE POLICY "Super admins can manage all extra charges" ON public.lead_extra_charges
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- SERVICE_CHECKLISTS TABLE - MECHANIC POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_checklists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "mechanic_own_checklists" ON public.service_checklists;
DROP POLICY IF EXISTS "Mechanics can view their checklists" ON public.service_checklists;
DROP POLICY IF EXISTS "Mechanics can update their checklists" ON public.service_checklists;
DROP POLICY IF EXISTS "Workshop admins can view checklists" ON public.service_checklists;
DROP POLICY IF EXISTS "Super admins can manage all checklists" ON public.service_checklists;

-- Policy: Mechanics can view their own checklists
CREATE POLICY "Mechanics can view their checklists" ON public.service_checklists
FOR SELECT
USING (
  mechanic_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Mechanics can update their own checklists
CREATE POLICY "Mechanics can update their checklists" ON public.service_checklists
FOR UPDATE
USING (
  mechanic_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  mechanic_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Mechanics can insert checklists (for auto-generation trigger)
CREATE POLICY "Mechanics can insert checklists" ON public.service_checklists
FOR INSERT
WITH CHECK (
  mechanic_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Workshop admins and supervisors can view checklists for their workshop
CREATE POLICY "Workshop admins can view checklists" ON public.service_checklists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = service_checklists.lead_id
    AND ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Super admins can manage all checklists
CREATE POLICY "Super admins can manage all checklists" ON public.service_checklists
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS Policies Fixed for lead_extra_charges and service_checklists!';
END $$;

