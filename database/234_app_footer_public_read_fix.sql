-- Allow mobile app to read admin-configured footer content without the web API route.
-- Admin saves keys like app_footer_stat1_value into system_settings (RLS blocks anon reads).

CREATE OR REPLACE FUNCTION public.get_public_app_footer_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(setting_key, setting_value),
    '{}'::jsonb
  )
  FROM public.system_settings
  WHERE setting_key IN (
    'app_footer_headline_line1',
    'app_footer_headline_line2',
    'app_footer_stat1_value',
    'app_footer_stat1_label',
    'app_footer_stat2_value',
    'app_footer_stat2_label',
    'app_footer_bottom_line',
    'app_footer_stat3_value',
    'app_footer_stat3_label',
    'app_footer_trust1_value',
    'app_footer_trust1_label',
    'app_footer_trust2_value',
    'app_footer_trust2_label',
    'app_footer_trust3_value',
    'app_footer_trust3_label',
    'app_footer_trust4_value',
    'app_footer_trust4_label'
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_app_footer_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_app_footer_config() TO anon, authenticated, service_role;
