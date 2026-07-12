-- Smart Tools Handler: admin-configurable tool visibility, ordering, and membership gating.

CREATE TABLE IF NOT EXISTS public.smart_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  tool_type TEXT NOT NULL DEFAULT 'native',
  screen_name TEXT,
  default_web_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  membership_only BOOLEAN NOT NULL DEFAULT false,
  requires_login BOOLEAN NOT NULL DEFAULT false,
  show_on_home BOOLEAN NOT NULL DEFAULT true,
  show_on_search BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  title_override TEXT,
  web_url_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smart_tools_display_order ON public.smart_tools(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_smart_tools_enabled ON public.smart_tools(enabled);

ALTER TABLE public.smart_tools ENABLE ROW LEVEL SECURITY;

INSERT INTO public.smart_tools (
  tool_id, title, subtitle, tool_type, screen_name, default_web_url,
  enabled, membership_only, requires_login, show_on_home, show_on_search, display_order
) VALUES
  ('car_health', 'Smart Health Checkup', 'AI vehicle health score', 'native', 'CarHealthCheck', NULL, true, false, false, true, true, 1),
  ('fuel_calculator', 'Fuel Cost Calculator', 'Trip fuel estimate', 'native', 'FuelCostCalculator', NULL, true, false, false, true, true, 2),
  ('price_compare', 'Compare Service Cost', 'Workshop price comparison', 'native', 'AuthorisedPricing', NULL, true, false, false, true, true, 3),
  ('car_loan', 'Loan Against Car', 'Instant loan options', 'webview', 'SmartToolWeb', 'https://myfng.in/car-loan?embed=1', true, false, false, true, true, 4),
  ('resale_value', 'Car Resale Value', 'Market resale estimate', 'native', 'ResaleValue', NULL, true, false, false, true, true, 5),
  ('car_quiz', 'Car Quiz', 'Daily car trivia', 'native', 'CarQuizGame', NULL, true, false, false, true, true, 6),
  ('parking_finder', 'Nearby Parking', 'Find parking near you', 'webview', 'SmartToolWeb', 'https://www.google.com/maps/search/parking+near+me', true, false, false, true, true, 7),
  ('parts_price', 'Check Parts Price', 'OEM parts price check', 'native', 'CarPartsPrice', NULL, true, false, false, true, true, 8)
ON CONFLICT (tool_id) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('smart_tools_section_enabled', 'true', 'BOOLEAN', 'APP', 'Show Smart Tools section on mobile home/search', 'true', true),
  ('smart_tools_section_title', 'Smart Tools', 'STRING', 'APP', 'Smart Tools section heading in mobile app', 'Smart Tools', true),
  ('smart_tools_section_subtitle', 'Smart car utilities for health, pricing, fuel & more', 'STRING', 'APP', 'Smart Tools section subtitle in mobile app', 'Smart car utilities for health, pricing, fuel & more', true)
ON CONFLICT (setting_key) DO NOTHING;

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
            'requires_login', requires_login,
            'show_on_home', show_on_home,
            'show_on_search', show_on_search,
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
