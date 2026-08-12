-- Smart Tools: per-tool phone allowlist (manual unlock for specific numbers)

ALTER TABLE public.smart_tools
  ADD COLUMN IF NOT EXISTS allowed_phones jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.smart_tools.allowed_phones IS
  'JSON array of 10-digit phones. Matching logged-in customers can see the tool even without membership.';

CREATE OR REPLACE FUNCTION public.get_public_smart_tools_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'section', jsonb_build_object(
      'enabled', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'smart_tools_section_enabled'), 'true'),
      'title', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'smart_tools_section_title'), 'Smart Tools'),
      'subtitle', COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'smart_tools_section_subtitle'), 'Smart car utilities for health, pricing, fuel & more')
    ),
    'tools', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'tool_id', tool_id,
            'title', title,
            'subtitle', subtitle,
            'tool_type', tool_type,
            'screen_name', screen_name,
            'default_web_url', default_web_url,
            'enabled', enabled,
            'membership_only', membership_only,
            'allowed_membership_plan_ids', COALESCE(allowed_membership_plan_ids, '[]'::jsonb),
            'allowed_phones', COALESCE(allowed_phones, '[]'::jsonb),
            'requires_login', requires_login,
            'show_on_home', show_on_home,
            'show_on_search', show_on_search,
            'placements', COALESCE(placements, '{}'::jsonb),
            'display_order', display_order,
            'title_override', title_override,
            'web_url_override', web_url_override
          )
          ORDER BY display_order ASC, title ASC
        )
        FROM smart_tools
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_smart_tools_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_smart_tools_config() TO anon, authenticated, service_role;
