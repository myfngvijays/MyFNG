-- RLS for membership CMS tables (run after 141 and 149)
-- Allows public read of active plans and super-admin full manage.

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active membership plans" ON public.membership_plans;
CREATE POLICY "Public can read active membership plans" ON public.membership_plans
FOR SELECT
USING (active IS TRUE);

DROP POLICY IF EXISTS "Super admins can manage membership plans" ON public.membership_plans;
CREATE POLICY "Super admins can manage membership plans" ON public.membership_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

DROP POLICY IF EXISTS "Public can read membership benefits" ON public.membership_benefits;
CREATE POLICY "Public can read membership benefits" ON public.membership_benefits
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins can manage membership benefits" ON public.membership_benefits;
CREATE POLICY "Super admins can manage membership benefits" ON public.membership_benefits
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
