-- =====================================================
-- FIX TELECALLER RLS IDENTITY MATCH (email/phone/uid)
-- Purpose:
--   Fix 403 inserts/selects caused by policies that only match
--   users_login via auth.email() exact equality.
--   This update matches current user by:
--     - lower(users_login.email) = lower(jwt.email)
--     - OR users_login.phone = jwt.phone
--     - OR users_login.id = auth.uid() (fallback for legacy setups)
-- =====================================================

-- =====================================================
-- 1) telecaller_follow_ups
-- =====================================================

DROP POLICY IF EXISTS "Telecallers can view their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can insert their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can update their own follow-ups" ON public.telecaller_follow_ups;
DROP POLICY IF EXISTS "Telecallers can delete their own follow-ups" ON public.telecaller_follow_ups;

CREATE POLICY "Telecallers can view their own follow-ups" ON public.telecaller_follow_ups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can insert their own follow-ups" ON public.telecaller_follow_ups
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can update their own follow-ups" ON public.telecaller_follow_ups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can delete their own follow-ups" ON public.telecaller_follow_ups
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_follow_ups.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

-- =====================================================
-- 2) telecaller_call_logs
-- =====================================================

DROP POLICY IF EXISTS "Telecallers can view their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can insert their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can update their own call logs" ON public.telecaller_call_logs;
DROP POLICY IF EXISTS "Telecallers can delete their own call logs" ON public.telecaller_call_logs;

CREATE POLICY "Telecallers can view their own call logs" ON public.telecaller_call_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can insert their own call logs" ON public.telecaller_call_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can update their own call logs" ON public.telecaller_call_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

CREATE POLICY "Telecallers can delete their own call logs" ON public.telecaller_call_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND telecaller_call_logs.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'LEAD_MANAGER'))
      )
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ Updated RLS identity matching for telecaller_follow_ups and telecaller_call_logs (email/phone/uid)';
END $$;


