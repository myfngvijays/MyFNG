-- =====================================================
-- FIX TELECALLER RLS POLICIES
-- Purpose: Allow telecallers to insert/select/update their own follow-ups and call logs
-- =====================================================

-- =====================================================
-- 1. telecaller_follow_ups RLS Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Telecallers can view their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can insert their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can update their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can delete their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Super admins can view all follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Lead managers can view all follow-ups" ON public.telecaller_follow_ups;

-- Policy: Telecallers can view their own follow-ups
CREATE POLICY "Telecallers can view their own follow-ups" ON public.telecaller_follow_ups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can view their own follow-ups
      (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
      -- Super admin and lead manager can view all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can insert their own follow-ups
CREATE POLICY "Telecallers can insert their own follow-ups" ON public.telecaller_follow_ups
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can only insert with their own ID
      (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
      -- Super admin and lead manager can insert for any telecaller
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can update their own follow-ups
CREATE POLICY "Telecallers can update their own follow-ups" ON public.telecaller_follow_ups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can update their own follow-ups
      (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
      -- Super admin and lead manager can update all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can only update with their own ID
      (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
      -- Super admin and lead manager can update all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can delete their own follow-ups
CREATE POLICY "Telecallers can delete their own follow-ups" ON public.telecaller_follow_ups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can delete their own follow-ups
      (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
      -- Super admin and lead manager can delete all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- =====================================================
-- 2. telecaller_call_logs RLS Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Telecallers can view their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can insert their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can update their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can delete their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Super admins can view all call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Lead managers can view all call logs" ON public.telecaller_call_logs;

-- Policy: Telecallers can view their own call logs
CREATE POLICY "Telecallers can view their own call logs" ON public.telecaller_call_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can view their own call logs
      (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
      -- Super admin and lead manager can view all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can insert their own call logs
CREATE POLICY "Telecallers can insert their own call logs" ON public.telecaller_call_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can only insert with their own ID
      (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
      -- Super admin and lead manager can insert for any telecaller
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can update their own call logs
CREATE POLICY "Telecallers can update their own call logs" ON public.telecaller_call_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can update their own call logs
      (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
      -- Super admin and lead manager can update all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can only update with their own ID
      (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
      -- Super admin and lead manager can update all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- Policy: Telecallers can delete their own call logs
CREATE POLICY "Telecallers can delete their own call logs" ON public.telecaller_call_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = (SELECT id FROM public.users_login WHERE email = auth.email())
    AND (
      -- Telecaller can delete their own call logs
      (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
      -- Super admin and lead manager can delete all
      OR r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER')
    )
  )
);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies created for telecaller_follow_ups and telecaller_call_logs!';
  RAISE NOTICE '✅ Telecallers can now insert/select/update their own records!';
  RAISE NOTICE '✅ Super admins and lead managers have full access!';
END $$;

