-- =====================================================
-- FIX RLS POLICIES FOR MECHANIC_JOB_PHOTOS
-- Purpose: Allow Workshop Supervisors to upload/manage photos
-- Date: 2025-12-02
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.mechanic_job_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Mechanics can view their job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics can insert their job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics can update their job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics can delete their job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics and supervisors can view job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics and supervisors can insert job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics and supervisors can update job photos" ON public.mechanic_job_photos;
DROP POLICY IF EXISTS "Mechanics and supervisors can delete job photos" ON public.mechanic_job_photos;

-- Policy: Mechanics and Supervisors can view job photos
CREATE POLICY "Mechanics and supervisors can view job photos"
ON public.mechanic_job_photos
FOR SELECT
USING (
  -- Mechanic assigned to the job
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  OR
  -- Supervisor assigned to the lead
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul2 ON sl.assigned_supervisor_id = ul2.id
    JOIN public.roles r ON r.id = ul2.role_id
    WHERE sl.id = mechanic_job_photos.lead_id
    AND ul2.id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
  OR
  -- Workshop Admin or Super Admin
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul2 ON ul2.workshop_id = sl.workshop_id
    JOIN public.roles r ON r.id = ul2.role_id
    WHERE sl.id = mechanic_job_photos.lead_id
    AND ul2.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
  )
);

-- Policy: Mechanics and Supervisors can insert job photos
CREATE POLICY "Mechanics and supervisors can insert job photos"
ON public.mechanic_job_photos
FOR INSERT
WITH CHECK (
  -- Must be uploaded by the current user
  uploaded_by = auth.uid()
  AND (
    -- Option 1: Mechanic assigned to the job (via mechanic_jobs table)
    EXISTS (
      SELECT 1 FROM public.mechanic_jobs mj
      WHERE mj.id = mechanic_job_photos.job_id
      AND mj.mechanic_id = auth.uid()
    )
    OR
    -- Option 2: Mechanic assigned to the lead (fallback - in case mechanic_jobs doesn't exist)
    EXISTS (
      SELECT 1 FROM public.service_leads sl
      WHERE sl.id = mechanic_job_photos.lead_id
      AND sl.assigned_mechanic_id = auth.uid()
    )
    OR
    -- Option 3: Supervisor assigned to the lead
    EXISTS (
      SELECT 1 FROM public.service_leads sl
      JOIN public.users_login ul2 ON sl.assigned_supervisor_id = ul2.id
      JOIN public.roles r ON r.id = ul2.role_id
      WHERE sl.id = mechanic_job_photos.lead_id
      AND ul2.id = auth.uid()
      AND r.role_code = 'WORKSHOP_SUPERVISOR'
    )
    OR
    -- Option 4: Super Admin
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Mechanics and Supervisors can update job photos
CREATE POLICY "Mechanics and supervisors can update job photos"
ON public.mechanic_job_photos
FOR UPDATE
USING (
  -- Mechanic assigned to the job
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  OR
  -- Supervisor assigned to the lead
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul2 ON sl.assigned_supervisor_id = ul2.id
    JOIN public.roles r ON r.id = ul2.role_id
    WHERE sl.id = mechanic_job_photos.lead_id
    AND ul2.id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
  OR
  -- Super Admin
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul2 ON sl.assigned_supervisor_id = ul2.id
    JOIN public.roles r ON r.id = ul2.role_id
    WHERE sl.id = mechanic_job_photos.lead_id
    AND ul2.id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Mechanics and Supervisors can delete job photos
CREATE POLICY "Mechanics and supervisors can delete job photos"
ON public.mechanic_job_photos
FOR DELETE
USING (
  (
    -- Mechanic assigned to the job (before completion)
    EXISTS (
      SELECT 1 FROM public.mechanic_jobs mj
      JOIN public.users_login ul ON mj.mechanic_id = ul.id
      WHERE mj.id = mechanic_job_photos.job_id
      AND ul.id = auth.uid()
      AND mj.mechanic_status != 'COMPLETED'
    )
    AND uploaded_by = auth.uid()
  )
  OR
  (
    -- Supervisor assigned to the lead
    EXISTS (
      SELECT 1 FROM public.service_leads sl
      JOIN public.users_login ul2 ON sl.assigned_supervisor_id = ul2.id
      JOIN public.roles r ON r.id = ul2.role_id
      WHERE sl.id = mechanic_job_photos.lead_id
      AND ul2.id = auth.uid()
      AND r.role_code = 'WORKSHOP_SUPERVISOR'
    )
  )
  OR
  (
    -- Super Admin
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
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
WHERE tablename = 'mechanic_job_photos'
ORDER BY policyname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- ✅ Workshop Supervisors can now:
--   1. View photos for leads they are assigned to
--   2. Insert photos for leads they are assigned to
--   3. Update photos for leads they are assigned to
--   4. Delete photos for leads they are assigned to
--
-- All policies check for assigned_supervisor_id to ensure proper access control.

