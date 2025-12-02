-- =====================================================
-- FIX RLS POLICIES FOR LEAD MANAGER
-- Purpose: Allow Lead Managers to view, update, and manage leads
-- =====================================================

-- =====================================================
-- SERVICE_LEADS TABLE - LEAD MANAGER POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing lead manager policies if any
DROP POLICY IF EXISTS "Lead managers can view all leads" ON public.service_leads;
DROP POLICY IF EXISTS "Lead managers can update leads" ON public.service_leads;
DROP POLICY IF EXISTS "Lead managers can insert leads" ON public.service_leads;

-- Policy: Lead Managers can view ALL leads (for assignment and management)
CREATE POLICY "Lead managers can view all leads" ON public.service_leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Policy: Lead Managers can update leads (validate, assign workshop, update status, etc.)
CREATE POLICY "Lead managers can update leads" ON public.service_leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Policy: Lead Managers can insert leads (if needed for manual creation)
CREATE POLICY "Lead managers can insert leads" ON public.service_leads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- =====================================================
-- WORKSHOPS TABLE - LEAD MANAGER VIEW PERMISSION
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.workshops ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Lead managers can view workshops" ON public.workshops;

-- Policy: Lead Managers can view workshops (for assignment)
CREATE POLICY "Lead managers can view workshops" ON public.workshops
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR is_verified = true  -- Also allow viewing verified workshops
);

-- =====================================================
-- CITIES TABLE - LEAD MANAGER VIEW PERMISSION
-- =====================================================

-- Policy already exists from previous script, but ensure Lead Manager can view
DROP POLICY IF EXISTS "Lead managers can view cities" ON public.cities;

CREATE POLICY "Lead managers can view cities" ON public.cities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR (auth.role() = 'authenticated' AND is_active = true)
);

-- =====================================================
-- CAR_MODELS TABLE - LEAD MANAGER VIEW PERMISSION
-- =====================================================

-- Policy already exists from previous script, but ensure Lead Manager can view
DROP POLICY IF EXISTS "Lead managers can view car models" ON public.car_models;

CREATE POLICY "Lead managers can view car models" ON public.car_models
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR (auth.role() = 'authenticated' AND is_active = true)
);

-- =====================================================
-- SERVICE_TYPES TABLE - LEAD MANAGER VIEW PERMISSION
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Lead managers can view service types" ON public.service_types;

CREATE POLICY "Lead managers can view service types" ON public.service_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR (auth.role() = 'authenticated' AND is_active = true)
);

-- =====================================================
-- SERVICE_ADDONS TABLE - LEAD MANAGER VIEW PERMISSION
-- =====================================================

-- Policy already exists, but ensure Lead Manager can view
DROP POLICY IF EXISTS "Lead managers can view service addons" ON public.service_addons;

CREATE POLICY "Lead managers can view service addons" ON public.service_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR (auth.role() = 'authenticated' AND is_active = true)
);

-- =====================================================
-- LEAD_EVENTS TABLE - LEAD MANAGER INSERT PERMISSION
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Lead managers can manage lead events" ON public.lead_events;

CREATE POLICY "Lead managers can manage lead events" ON public.lead_events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- =====================================================
-- LEAD_ACTIVITIES TABLE - LEAD MANAGER INSERT PERMISSION
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_activities') THEN
    ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Lead managers can manage lead activities" ON public.lead_activities;
    
    CREATE POLICY "Lead managers can manage lead activities" ON public.lead_activities
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
      )
    );
  END IF;
END $$;

-- =====================================================
-- LEAD_STATUS_HISTORY TABLE - LEAD MANAGER INSERT PERMISSION
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_status_history') THEN
    ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Lead managers can manage lead status history" ON public.lead_status_history;
    
    CREATE POLICY "Lead managers can manage lead status history" ON public.lead_status_history
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created for Lead Manager!';
    RAISE NOTICE '✅ Lead Managers can now view, update, and manage leads!';
    RAISE NOTICE '✅ Lead Managers can view workshops, cities, car models, service types, and addons!';
END $$;

