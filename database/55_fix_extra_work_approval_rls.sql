-- =====================================================
-- MIGRATION: Fix Extra Work Approval/Rejection RLS
-- Purpose: Allow Workshop Supervisors to approve/reject extra work requests
-- Date: 2025-12-04
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_extra_charges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Workshop admins can manage extra charges" ON public.lead_extra_charges;

-- Policy: Workshop supervisors and admins can update extra charges for their workshop
-- This policy allows UPDATE operations for supervisors/admins from the same workshop as the lead
CREATE POLICY "Workshop supervisors can manage extra charges" ON public.lead_extra_charges
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.workshop_id = ul.workshop_id
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN')
  )
  OR
  -- Also allow if supervisor is assigned to the lead
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.assigned_supervisor_id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.workshop_id = ul.workshop_id
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN')
  )
  OR
  -- Also allow if supervisor is assigned to the lead
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.assigned_supervisor_id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
);

-- Policy: Workshop supervisors and admins can view extra charges for their workshop
CREATE POLICY "Workshop supervisors can view extra charges" ON public.lead_extra_charges
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.workshop_id = ul.workshop_id
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN')
  )
  OR
  -- Also allow if supervisor is assigned to the lead
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    JOIN public.users_login ul ON ul.id = auth.uid()
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_extra_charges.lead_id
    AND sl.assigned_supervisor_id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
  OR
  -- Mechanics can view their own extra work requests
  EXISTS (
    SELECT 1 
    FROM public.mechanic_jobs mj
    WHERE mj.lead_id = lead_extra_charges.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  -- Super admins can view all
  EXISTS (
    SELECT 1 
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Mechanics can insert extra work requests (keep existing)
-- This policy should already exist from migration 50, but ensure it's there
DROP POLICY IF EXISTS "Mechanics can insert extra work requests" ON public.lead_extra_charges;
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

-- Policy: Super admins can manage all extra charges (keep existing)
DROP POLICY IF EXISTS "Super admins can manage all extra charges" ON public.lead_extra_charges;
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

DO $$
BEGIN
    RAISE NOTICE '✅ RLS Policies Fixed for extra work approval/rejection!';
    RAISE NOTICE 'ℹ️  Workshop Supervisors can now approve/reject extra work requests.';
END $$;

