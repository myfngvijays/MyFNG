-- Final Fix for job_cards RLS - Very Permissive
-- This should definitely fix the 406 error

-- ============================================
-- Drop all existing policies
-- ============================================
DROP POLICY IF EXISTS "Mechanics can view job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Workshop staff can view job cards for their workshop" ON public.job_cards;
DROP POLICY IF EXISTS "Allow workshop staff and admins to view job cards" ON public.job_cards;
DROP POLICY IF EXISTS "Mechanics can create job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Allow workshop staff to create job cards" ON public.job_cards;
DROP POLICY IF EXISTS "Mechanics can update job cards for their assigned leads" ON public.job_cards;
DROP POLICY IF EXISTS "Allow workshop staff to update job cards" ON public.job_cards;

DROP POLICY IF EXISTS "Users can view parts for accessible job cards" ON public.job_card_parts;
DROP POLICY IF EXISTS "Mechanics can manage parts for their job cards" ON public.job_card_parts;
DROP POLICY IF EXISTS "Allow workshop staff to view job card parts" ON public.job_card_parts;
DROP POLICY IF EXISTS "Allow workshop staff to manage job card parts" ON public.job_card_parts;

-- ============================================
-- Very Simple SELECT Policy for job_cards
-- ============================================
CREATE POLICY "job_cards_select_policy"
ON public.job_cards
FOR SELECT
USING (
  -- Allow if user has admin/supervisor/manager/billing role
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING', 'ACCOUNTS_TEAM')
  )
  OR
  -- Allow if user is mechanic assigned to this lead
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  -- Allow if lead is assigned to user as mechanic
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = job_cards.lead_id
    AND sl.assigned_mechanic_id = auth.uid()
  )
  OR
  -- Allow if user's workshop_id matches lead's workshop_id (simple check)
  (
    SELECT ul.workshop_id FROM public.users_login ul WHERE ul.id = auth.uid()
  ) = (
    SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id
  )
);

-- ============================================
-- INSERT Policy for job_cards
-- ============================================
CREATE POLICY "job_cards_insert_policy"
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
  (
    SELECT ul.workshop_id FROM public.users_login ul WHERE ul.id = auth.uid()
  ) = (
    SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id
  )
);

-- ============================================
-- UPDATE Policy for job_cards
-- ============================================
CREATE POLICY "job_cards_update_policy"
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
  (
    SELECT ul.workshop_id FROM public.users_login ul WHERE ul.id = auth.uid()
  ) = (
    SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id
  )
);

-- ============================================
-- SELECT Policy for job_card_parts
-- ============================================
CREATE POLICY "job_card_parts_select_policy"
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
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING', 'ACCOUNTS_TEAM')
      )
      OR
      EXISTS (
        SELECT 1 FROM public.mechanic_jobs mj
        WHERE mj.lead_id = jc.lead_id
        AND mj.mechanic_id = auth.uid()
      )
      OR
      (
        SELECT ul.workshop_id FROM public.users_login ul WHERE ul.id = auth.uid()
      ) = (
        SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = jc.lead_id
      )
    )
  )
);

-- ============================================
-- ALL Policy for job_card_parts (INSERT/UPDATE/DELETE)
-- ============================================
CREATE POLICY "job_card_parts_all_policy"
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
      (
        SELECT ul.workshop_id FROM public.users_login ul WHERE ul.id = auth.uid()
      ) = (
        SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = jc.lead_id
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

