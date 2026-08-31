-- Fix mechanic_jobs RLS when auth.users.id != users_login.id (email-mapped accounts)
-- Symptom: mechanic dashboard shows 0 jobs even after advisor assigns mechanic

DROP POLICY IF EXISTS "Mechanics can view their own jobs" ON public.mechanic_jobs;
DROP POLICY IF EXISTS "Mechanics can update their own jobs" ON public.mechanic_jobs;

CREATE POLICY "Mechanics can view their own jobs"
ON public.mechanic_jobs
FOR SELECT
TO authenticated
USING (
  mechanic_id = auth.uid()
  OR mechanic_id IN (
    SELECT ul.id FROM public.users_login ul
    WHERE lower(trim(ul.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);

CREATE POLICY "Mechanics can update their own jobs"
ON public.mechanic_jobs
FOR UPDATE
TO authenticated
USING (
  mechanic_id = auth.uid()
  OR mechanic_id IN (
    SELECT ul.id FROM public.users_login ul
    WHERE lower(trim(ul.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
)
WITH CHECK (
  mechanic_id = auth.uid()
  OR mechanic_id IN (
    SELECT ul.id FROM public.users_login ul
    WHERE lower(trim(ul.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);

-- Mechanics should read assigned leads for dashboard joins
DROP POLICY IF EXISTS "Mechanics can view assigned leads" ON public.service_leads;
CREATE POLICY "Mechanics can view assigned leads"
ON public.service_leads
FOR SELECT
TO authenticated
USING (
  assigned_mechanic_id = auth.uid()
  OR assigned_mechanic_id IN (
    SELECT ul.id FROM public.users_login ul
    WHERE lower(trim(ul.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);
