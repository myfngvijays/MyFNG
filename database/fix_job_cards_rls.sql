-- Fix RLS Policies for job_cards and job_card_parts tables
-- This allows mechanics to access job cards for their assigned leads

-- ============================================
-- Enable RLS on job_cards if not already enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies if any
-- ============================================
DROP POLICY IF EXISTS "Mechanics can view job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Workshop staff can view job cards for their workshop" ON public.job_cards;
DROP POLICY IF EXISTS "Mechanics can create job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Mechanics can update job cards for their assigned leads" ON public.job_cards;

-- ============================================
-- Policy: Mechanics can view job cards for their assigned leads
-- ============================================
CREATE POLICY "Mechanics can view job cards for their assigned leads"
ON public.job_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.lead_id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_mechanic_id = ul.id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
    AND ul.workshop_id IS NOT NULL
  )
  OR
  -- Allow access if user is workshop admin and lead belongs to their workshop
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_ADMIN'
    AND ul.workshop_id IS NOT NULL
  )
);

-- ============================================
-- Policy: Workshop staff can view job cards for their workshop
-- ============================================
CREATE POLICY "Workshop staff can view job cards for their workshop"
ON public.job_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
    AND ul.workshop_id IS NOT NULL
  )
);

-- ============================================
-- Policy: Mechanics can create job cards for their assigned leads
-- ============================================
CREATE POLICY "Mechanics can create job cards for their assigned leads"
ON public.job_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.lead_id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_mechanic_id = ul.id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- ============================================
-- Policy: Mechanics can update job cards for their assigned leads
-- ============================================
CREATE POLICY "Mechanics can update job cards for their assigned leads"
ON public.job_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.lead_id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_mechanic_id = ul.id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- ============================================
-- Enable RLS on job_card_parts if not already enabled
-- ============================================
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies for job_card_parts if any
-- ============================================
DROP POLICY IF EXISTS "Users can view parts for accessible job cards" ON public.job_card_parts;
DROP POLICY IF EXISTS "Mechanics can manage parts for their job cards" ON public.job_card_parts;

-- ============================================
-- Policy: Users can view parts for accessible job cards
-- ============================================
CREATE POLICY "Users can view parts for accessible job cards"
ON public.job_card_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 FROM public.mechanic_jobs mj
        JOIN public.users_login ul ON mj.mechanic_id = ul.id
        WHERE mj.lead_id = jc.lead_id
        AND ul.id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.service_leads sl
        JOIN public.users_login ul ON sl.assigned_mechanic_id = ul.id
        WHERE sl.id = jc.lead_id
        AND ul.id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING')
      )
      OR
      EXISTS (
        SELECT 1 FROM public.service_leads sl
        JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
        WHERE sl.id = jc.lead_id
        AND ul.id = auth.uid()
        AND ul.workshop_id IS NOT NULL
      )
    )
  )
);

-- ============================================
-- Policy: Mechanics can manage parts for their job cards
-- ============================================
CREATE POLICY "Mechanics can manage parts for their job cards"
ON public.job_card_parts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 FROM public.mechanic_jobs mj
        JOIN public.users_login ul ON mj.mechanic_id = ul.id
        WHERE mj.lead_id = jc.lead_id
        AND ul.id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.service_leads sl
        JOIN public.users_login ul ON sl.assigned_mechanic_id = ul.id
        WHERE sl.id = jc.lead_id
        AND ul.id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      )
    )
  )
);

-- ============================================
-- Verification
-- ============================================
-- Check if policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

