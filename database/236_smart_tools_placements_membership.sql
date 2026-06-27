-- Smart Tools: per-plan visibility + per-screen placements (run after 235)

ALTER TABLE public.smart_tools
  ADD COLUMN IF NOT EXISTS allowed_membership_plan_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS placements jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.smart_tools.allowed_membership_plan_ids IS 'Empty = any active membership when membership_only; non-empty = only these plan UUIDs';
COMMENT ON COLUMN public.smart_tools.placements IS 'Per-screen slots, e.g. home.main_grid, search.after_other_services';

-- Migrate legacy show_on_home / show_on_search booleans into placements
UPDATE public.smart_tools
SET placements = jsonb_build_object(
  'home', jsonb_build_object('main_grid', COALESCE(show_on_home, true)),
  'search', jsonb_build_object('main_grid', COALESCE(show_on_search, true))
)
WHERE placements = '{}'::jsonb OR placements IS NULL;

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
