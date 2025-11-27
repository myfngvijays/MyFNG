-- Proper RLS Policy with Better Logic
-- This version uses service_role bypass and proper checks

-- ============================================
-- Step 1: Drop all existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_select_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_insert_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_update_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_select_policy" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_card_parts_all_policy" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_allow_authenticated" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_allow_authenticated" ON public.job_card_parts;

-- ============================================
-- Step 2: Ensure RLS is enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create SELECT Policy with Better Logic
-- ============================================
CREATE POLICY "job_cards_select_allowed"
ON public.job_cards
FOR SELECT
TO authenticated
USING (
  -- Check 1: User has admin/supervisor/manager/billing role
  EXISTS (
    SELECT 1 
    FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN (
      'SUPER_ADMIN', 
      'WORKSHOP_ADMIN', 
      'WORKSHOP_SUPERVISOR', 
      'LEAD_MANAGER', 
      'BILLING', 
      'ACCOUNTS_TEAM'
    )
  )
  OR
  -- Check 2: User is mechanic assigned to this lead via mechanic_jobs
  EXISTS (
    SELECT 1 
    FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  -- Check 3: User is assigned as mechanic in service_leads
  EXISTS (
    SELECT 1 
    FROM public.service_leads sl
    WHERE sl.id = job_cards.lead_id
    AND sl.assigned_mechanic_id = auth.uid()
  )
  OR
  -- Check 4: User's workshop matches lead's workshop (handle NULL)
  COALESCE(
    (SELECT u.workshop_id FROM public.users_login u WHERE u.id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) = COALESCE(
    (SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
);

-- ============================================
-- Step 4: Create INSERT Policy
-- ============================================
CREATE POLICY "job_cards_insert_allowed"
ON public.job_cards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
  OR
  EXISTS (
    SELECT 1 
    FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  COALESCE(
    (SELECT u.workshop_id FROM public.users_login u WHERE u.id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) = COALESCE(
    (SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
);

-- ============================================
-- Step 5: Create UPDATE Policy
-- ============================================
CREATE POLICY "job_cards_update_allowed"
ON public.job_cards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
  OR
  EXISTS (
    SELECT 1 
    FROM public.mechanic_jobs mj
    WHERE mj.lead_id = job_cards.lead_id
    AND mj.mechanic_id = auth.uid()
  )
  OR
  COALESCE(
    (SELECT u.workshop_id FROM public.users_login u WHERE u.id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) = COALESCE(
    (SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = job_cards.lead_id),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
);

-- ============================================
-- Step 6: Create job_card_parts Policies
-- ============================================
CREATE POLICY "job_card_parts_select_allowed"
ON public.job_card_parts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 
        FROM public.users_login u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_code IN (
          'SUPER_ADMIN', 
          'WORKSHOP_ADMIN', 
          'WORKSHOP_SUPERVISOR', 
          'LEAD_MANAGER', 
          'BILLING', 
          'ACCOUNTS_TEAM'
        )
      )
      OR
      EXISTS (
        SELECT 1 
        FROM public.mechanic_jobs mj
        WHERE mj.lead_id = jc.lead_id
        AND mj.mechanic_id = auth.uid()
      )
      OR
      COALESCE(
        (SELECT u.workshop_id FROM public.users_login u WHERE u.id = auth.uid()),
        '00000000-0000-0000-0000-000000000000'::uuid
      ) = COALESCE(
        (SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = jc.lead_id),
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    )
  )
);

CREATE POLICY "job_card_parts_all_allowed"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.job_cards jc
    WHERE jc.id = job_card_parts.job_card_id
    AND (
      EXISTS (
        SELECT 1 
        FROM public.users_login u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      )
      OR
      EXISTS (
        SELECT 1 
        FROM public.mechanic_jobs mj
        WHERE mj.lead_id = jc.lead_id
        AND mj.mechanic_id = auth.uid()
      )
      OR
      COALESCE(
        (SELECT u.workshop_id FROM public.users_login u WHERE u.id = auth.uid()),
        '00000000-0000-0000-0000-000000000000'::uuid
      ) = COALESCE(
        (SELECT sl.workshop_id FROM public.service_leads sl WHERE sl.id = jc.lead_id),
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    )
  )
);

-- ============================================
-- Step 7: Verification
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

