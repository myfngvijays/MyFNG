-- Simplified RLS Policies for job_cards - More Permissive
-- This fixes 406 errors by allowing workshop admins to access job_cards

-- ============================================
-- Drop and recreate SELECT policy with simpler logic
-- ============================================
DROP POLICY IF EXISTS "Mechanics can view job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Workshop staff can view job cards for their workshop" ON public.job_cards;

-- Simple policy: Allow access if user has any of these roles OR if lead belongs to their workshop
-- Using simpler checks to avoid join issues
CREATE POLICY "Allow workshop staff and admins to view job cards"
ON public.job_cards
FOR SELECT
USING (
  -- First check: User has admin/supervisor/manager/billing role
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING')
  )
  OR
  -- Second check: User is mechanic assigned to this lead
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  -- Third check: Lead is assigned to user as mechanic
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = job_cards.lead_id
    AND sl.assigned_mechanic_id = auth.uid()
  )
  OR
  -- Fourth check: User's workshop matches lead's workshop (simplified)
  (
    EXISTS (
      SELECT 1 FROM public.service_leads sl
      WHERE sl.id = job_cards.lead_id
      AND sl.workshop_id IS NOT NULL
    )
    AND
    EXISTS (
      SELECT 1 FROM public.users_login ul
      WHERE ul.id = auth.uid()
      AND ul.workshop_id IS NOT NULL
      AND ul.workshop_id = (
        SELECT sl2.workshop_id 
        FROM public.service_leads sl2 
        WHERE sl2.id = job_cards.lead_id
      )
    )
  )
);

-- ============================================
-- Update INSERT policy
-- ============================================
DROP POLICY IF EXISTS "Mechanics can create job cards for their assigned leads" ON public.job_cards;

CREATE POLICY "Allow workshop staff to create job cards"
ON public.job_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = job_cards.lead_id
    AND sl.assigned_mechanic_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
    AND ul.workshop_id IS NOT NULL
    AND sl.workshop_id = ul.workshop_id
  )
);

-- ============================================
-- Update UPDATE policy
-- ============================================
DROP POLICY IF EXISTS "Mechanics can update job cards for their assigned leads" ON public.job_cards;

CREATE POLICY "Allow workshop staff to update job cards"
ON public.job_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = job_cards.lead_id
    AND sl.assigned_mechanic_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
    WHERE sl.id = job_cards.lead_id
    AND ul.id = auth.uid()
    AND ul.workshop_id IS NOT NULL
    AND sl.workshop_id = ul.workshop_id
  )
);

-- ============================================
-- Update job_card_parts policies
-- ============================================
DROP POLICY IF EXISTS "Users can view parts for accessible job cards" ON public.job_card_parts;
DROP POLICY IF EXISTS "Mechanics can manage parts for their job cards" ON public.job_card_parts;

CREATE POLICY "Allow workshop staff to view job card parts"
ON public.job_card_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING')
      )
      OR
      EXISTS (
        SELECT 1 FROM public.mechanic_jobs mj
        WHERE mj.lead_id = jc.lead_id
        AND mj.mechanic_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.service_leads sl
        JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
        WHERE sl.id = jc.lead_id
        AND ul.id = auth.uid()
        AND ul.workshop_id IS NOT NULL
        AND sl.workshop_id = ul.workshop_id
      )
    )
  )
);

CREATE POLICY "Allow workshop staff to manage job card parts"
ON public.job_card_parts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      )
      OR
      EXISTS (
        SELECT 1 FROM public.mechanic_jobs mj
        WHERE mj.lead_id = jc.lead_id
        AND mj.mechanic_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.service_leads sl
        JOIN public.users_login ul ON sl.workshop_id = ul.workshop_id
        WHERE sl.id = jc.lead_id
        AND ul.id = auth.uid()
        AND ul.workshop_id IS NOT NULL
        AND sl.workshop_id = ul.workshop_id
      )
    )
  )
);

-- ============================================
-- Verification
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

