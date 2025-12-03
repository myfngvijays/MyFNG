-- =====================================================
-- FIX RLS POLICIES FOR WORKSHOP SUPERVISOR
-- Purpose: Allow Workshop Supervisors to view and accept/reject pending leads
-- Date: 2025-12-02
-- =====================================================

-- =====================================================
-- SERVICE_LEADS TABLE - WORKSHOP SUPERVISOR POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing supervisor policies if any
DROP POLICY IF EXISTS "Workshop supervisors can view their workshop leads" ON public.service_leads;
DROP POLICY IF EXISTS "Workshop supervisors can update their workshop leads" ON public.service_leads;

-- Policy: Workshop Supervisors can view leads assigned to their workshop
-- (especially pending leads for acceptance)
CREATE POLICY "Workshop supervisors can view their workshop leads" ON public.service_leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      -- Lead is assigned to their workshop
      service_leads.workshop_id = ul.workshop_id
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Supervisors can update leads assigned to their workshop
-- (to accept/reject and auto-assign themselves as supervisor)
CREATE POLICY "Workshop supervisors can update their workshop leads" ON public.service_leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
    AND (
      service_leads.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
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
      service_leads.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- LEAD_EVENTS TABLE - WORKSHOP SUPERVISOR POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_events ENABLE ROW LEVEL SECURITY;

-- Drop existing supervisor policies if any
DROP POLICY IF EXISTS "Workshop supervisors can view their workshop lead events" ON public.lead_events;
DROP POLICY IF EXISTS "Workshop supervisors can insert lead events" ON public.lead_events;

-- Policy: Workshop Supervisors can view lead events for their workshop's leads
CREATE POLICY "Workshop supervisors can view their workshop lead events" ON public.lead_events
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
        WHERE sl.id = lead_events.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Supervisors can insert lead events for their workshop's leads
CREATE POLICY "Workshop supervisors can insert lead events" ON public.lead_events
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
        WHERE sl.id = lead_events.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- LEAD_STATUS_HISTORY TABLE - WORKSHOP SUPERVISOR POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing supervisor policies if any
DROP POLICY IF EXISTS "Workshop supervisors can view their workshop status history" ON public.lead_status_history;
DROP POLICY IF EXISTS "Workshop supervisors can insert status history" ON public.lead_status_history;

-- Policy: Workshop Supervisors can view status history for their workshop's leads
CREATE POLICY "Workshop supervisors can view their workshop status history" ON public.lead_status_history
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
        WHERE sl.id = lead_status_history.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Supervisors can insert status history for their workshop's leads
CREATE POLICY "Workshop supervisors can insert status history" ON public.lead_status_history
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
        WHERE sl.id = lead_status_history.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- LEAD_ACTIVITIES TABLE - WORKSHOP SUPERVISOR POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing supervisor policies if any
DROP POLICY IF EXISTS "Workshop supervisors can view their workshop activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Workshop supervisors can insert activities" ON public.lead_activities;

-- Policy: Workshop Supervisors can view activities for their workshop's leads
CREATE POLICY "Workshop supervisors can view their workshop activities" ON public.lead_activities
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
        WHERE sl.id = lead_activities.lead_id
        AND sl.workshop_id = ul.workshop_id
      )
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Supervisors can insert activities for their workshop's leads
CREATE POLICY "Workshop supervisors can insert activities" ON public.lead_activities
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
        WHERE sl.id = lead_activities.lead_id
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
WHERE tablename IN ('service_leads', 'lead_events', 'lead_status_history', 'lead_activities')
  AND policyname LIKE '%supervisor%'
ORDER BY tablename, policyname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- ✅ Workshop Supervisors can now:
--   1. View leads assigned to their workshop (especially pending leads)
--   2. Update leads to accept/reject and auto-assign themselves
--   3. View and insert lead events
--   4. View and insert lead status history
--   5. View and insert lead activities
--
-- All policies are scoped to the supervisor's workshop_id to ensure data isolation.

