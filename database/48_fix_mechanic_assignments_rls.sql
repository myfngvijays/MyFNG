-- =====================================================
-- FIX RLS POLICIES FOR MECHANIC_ASSIGNMENTS
-- Purpose: Allow Workshop Supervisors to insert mechanic assignments
-- Date: 2025-12-02
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.mechanic_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing supervisor policies if any
DROP POLICY IF EXISTS "Workshop supervisors can view mechanic assignments" ON public.mechanic_assignments;
DROP POLICY IF EXISTS "Workshop supervisors can insert mechanic assignments" ON public.mechanic_assignments;
DROP POLICY IF EXISTS "Workshop supervisors can update mechanic assignments" ON public.mechanic_assignments;

-- Policy: Workshop Supervisors can view mechanic assignments for their workshop's leads
CREATE POLICY "Workshop supervisors can view mechanic assignments" ON public.mechanic_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      -- Lead belongs to their workshop
      EXISTS (
        SELECT 1 FROM service_leads sl
        WHERE sl.id = mechanic_assignments.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Supervisors can insert mechanic assignments for their workshop's leads
CREATE POLICY "Workshop supervisors can insert mechanic assignments" ON public.mechanic_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      -- Lead belongs to their workshop
      EXISTS (
        SELECT 1 FROM service_leads sl
        WHERE sl.id = mechanic_assignments.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
  AND assigned_by = auth.uid()
);

-- Policy: Workshop Supervisors can update mechanic assignments for their workshop's leads
CREATE POLICY "Workshop supervisors can update mechanic assignments" ON public.mechanic_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      -- Lead belongs to their workshop
      EXISTS (
        SELECT 1 FROM service_leads sl
        WHERE sl.id = mechanic_assignments.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      -- Lead belongs to their workshop
      EXISTS (
        SELECT 1 FROM service_leads sl
        WHERE sl.id = mechanic_assignments.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'mechanic_assignments'
  AND policyname LIKE '%supervisor%'
ORDER BY policyname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- ✅ Workshop Supervisors can now:
--   1. View mechanic assignments for leads in their workshop
--   2. Insert mechanic assignments for leads in their workshop
--   3. Update mechanic assignments for leads in their workshop
--
-- All policies are scoped to the supervisor's workshop_id to ensure data isolation.

