-- Fix mobile app not loading membership plans (RSA + Service) via Supabase anon key.
-- Ensures public read policies exist and adds SECURITY DEFINER RPC fallback.

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active membership plans" ON public.membership_plans;
CREATE POLICY "Public can read active membership plans" ON public.membership_plans
FOR SELECT
USING (active IS TRUE);

DROP POLICY IF EXISTS "Public can read membership benefits" ON public.membership_benefits;
CREATE POLICY "Public can read membership benefits" ON public.membership_benefits
FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.get_public_membership_plans()
RETURNS SETOF public.membership_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.membership_plans
  WHERE active IS TRUE
    AND COALESCE(app_visible, true) IS TRUE
  ORDER BY display_order ASC NULLS LAST, created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_membership_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_membership_plans() TO anon, authenticated, service_role;
