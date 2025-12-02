-- =====================================================
-- FIX RLS POLICIES FOR WORKSHOP ADMIN
-- Purpose: Allow Workshop Admins to manage their workshop's leads, staff, and operations
-- =====================================================

-- =====================================================
-- SERVICE_LEADS TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing workshop admin policies if any
DROP POLICY IF EXISTS "Workshop admins can view their leads" ON public.service_leads;
DROP POLICY IF EXISTS "Workshop admins can update their leads" ON public.service_leads;
DROP POLICY IF EXISTS "Workshop admins can accept reject leads" ON public.service_leads;

-- Policy: Workshop Admins can view leads assigned to their workshop
CREATE POLICY "Workshop admins can view their leads" ON public.service_leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      -- Lead is assigned to their workshop
      service_leads.workshop_id = ul.workshop_id
      OR
      -- Or they are super admin
      r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can update leads assigned to their workshop
CREATE POLICY "Workshop admins can update their leads" ON public.service_leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
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
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      service_leads.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- USERS_LOGIN TABLE - WORKSHOP ADMIN STAFF MANAGEMENT
-- =====================================================
-- NOTE: We cannot create RLS policies on users_login that reference users_login itself
-- as it causes infinite recursion. The existing policies from 26_fix_users_login_rls_recursion.sql
-- handle basic access. Workshop Admin staff management should be handled at the API level
-- after fetching the user's own profile to check their role and workshop_id.
-- 
-- The API routes will:
-- 1. Fetch the authenticated user's profile (allowed by existing policy)
-- 2. Check if user.role = 'WORKSHOP_ADMIN' and get user.workshop_id
-- 3. Then fetch/manage staff members with workshop_id filter at application level
-- =====================================================

-- We keep the existing simple policies from 26_fix_users_login_rls_recursion.sql:
-- - "Users can view own profile" (id = auth.uid())
-- - "Authenticated users can view users" (auth.role() = 'authenticated')
-- - "Users can update own profile" (id = auth.uid())
-- - "Allow user profile creation" (auth.role() = 'authenticated' AND id = auth.uid())
--
-- These policies avoid recursion by using auth.uid() and auth.role() directly
-- without querying users_login table itself.

-- =====================================================
-- JOB_CARDS TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.job_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Workshop admins can view their job cards" ON public.job_cards;
DROP POLICY IF EXISTS "Workshop admins can manage their job cards" ON public.job_cards;

-- Policy: Workshop Admins can view job cards for their workshop's leads
CREATE POLICY "Workshop admins can view their job cards" ON public.job_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON job_cards.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can manage job cards for their workshop's leads
CREATE POLICY "Workshop admins can manage their job cards" ON public.job_cards
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON job_cards.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON job_cards.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- JOB_CARD_PARTS TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Workshop admins can view their job card parts" ON public.job_card_parts;
DROP POLICY IF EXISTS "Workshop admins can manage their job card parts" ON public.job_card_parts;

-- Policy: Workshop Admins can view/manage job card parts
CREATE POLICY "Workshop admins can manage their job card parts" ON public.job_card_parts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN job_cards jc ON job_card_parts.job_card_id = jc.id
    JOIN service_leads sl ON jc.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN job_cards jc ON job_card_parts.job_card_id = jc.id
    JOIN service_leads sl ON jc.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- INVOICES TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Workshop admins can view their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workshop admins can manage their invoices" ON public.invoices;

-- Policy: Workshop Admins can view invoices for their workshop's leads
CREATE POLICY "Workshop admins can view their invoices" ON public.invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON invoices.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can update invoices for their workshop's leads
CREATE POLICY "Workshop admins can manage their invoices" ON public.invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON invoices.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON invoices.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- WORKSHOPS TABLE - WORKSHOP ADMIN VIEW OWN WORKSHOP
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.workshops ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Workshop admins can view their workshop" ON public.workshops;

-- Policy: Workshop Admins can view their own workshop details
CREATE POLICY "Workshop admins can view their workshop" ON public.workshops
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      workshops.id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can update their own workshop details
CREATE POLICY "Workshop admins can update their workshop" ON public.workshops
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshops.id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshops.id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- WORKSHOP_PRODUCT_PRICING TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.workshop_product_pricing ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Workshop admins can view their pricing" ON public.workshop_product_pricing;
DROP POLICY IF EXISTS "Workshop admins can manage their pricing" ON public.workshop_product_pricing;

-- Policy: Workshop Admins can view their workshop's pricing
CREATE POLICY "Workshop admins can view their pricing" ON public.workshop_product_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_product_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can update their workshop's pricing
CREATE POLICY "Workshop admins can manage their pricing" ON public.workshop_product_pricing
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_product_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_product_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- WORKSHOP_SERVICE_PRICING TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.workshop_service_pricing ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Workshop admins can view their service pricing" ON public.workshop_service_pricing;
DROP POLICY IF EXISTS "Workshop admins can manage their service pricing" ON public.workshop_service_pricing;

-- Policy: Workshop Admins can view their workshop's service pricing
CREATE POLICY "Workshop admins can view their service pricing" ON public.workshop_service_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_service_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- Policy: Workshop Admins can update their workshop's service pricing
CREATE POLICY "Workshop admins can manage their service pricing" ON public.workshop_service_pricing
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_service_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN')
    AND (
      workshop_service_pricing.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- LEAD_EVENTS TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.lead_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Workshop admins can manage lead events" ON public.lead_events;

-- Policy: Workshop Admins can insert/update lead events for their workshop's leads
CREATE POLICY "Workshop admins can manage lead events" ON public.lead_events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON lead_events.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    JOIN service_leads sl ON lead_events.lead_id = sl.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND (
      sl.workshop_id = ul.workshop_id
      OR r.role_code = 'SUPER_ADMIN'
    )
  )
);

-- =====================================================
-- LEAD_ACTIVITIES TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_activities') THEN
    ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Workshop admins can manage lead activities" ON public.lead_activities;
    
    CREATE POLICY "Workshop admins can manage lead activities" ON public.lead_activities
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON lead_activities.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON lead_activities.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    );
  END IF;
END $$;

-- =====================================================
-- LEAD_STATUS_HISTORY TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_status_history') THEN
    ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Workshop admins can manage lead status history" ON public.lead_status_history;
    
    CREATE POLICY "Workshop admins can manage lead status history" ON public.lead_status_history
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON lead_status_history.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON lead_status_history.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    );
  END IF;
END $$;

-- =====================================================
-- MECHANIC_ASSIGNMENTS TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mechanic_assignments') THEN
    ALTER TABLE public.mechanic_assignments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Workshop admins can manage mechanic assignments" ON public.mechanic_assignments;
    
    CREATE POLICY "Workshop admins can manage mechanic assignments" ON public.mechanic_assignments
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON mechanic_assignments.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON mechanic_assignments.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    );
  END IF;
END $$;

-- =====================================================
-- PICKUP_TRACKING TABLE - WORKSHOP ADMIN POLICIES
-- =====================================================

-- Ensure RLS is enabled (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pickup_tracking') THEN
    ALTER TABLE public.pickup_tracking ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Workshop admins can manage pickup tracking" ON public.pickup_tracking;
    
    CREATE POLICY "Workshop admins can manage pickup tracking" ON public.pickup_tracking
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON pickup_tracking.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users_login ul
        JOIN roles r ON ul.role_id = r.id
        JOIN service_leads sl ON pickup_tracking.lead_id = sl.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('WORKSHOP_ADMIN', 'SUPER_ADMIN', 'WORKSHOP_SUPERVISOR')
        AND (
          sl.workshop_id = ul.workshop_id
          OR r.role_code = 'SUPER_ADMIN'
        )
      )
    );
  END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created for Workshop Admin!';
    RAISE NOTICE '✅ Workshop Admins can now view and manage their workshop leads, staff, job cards, invoices, and pricing!';
END $$;

