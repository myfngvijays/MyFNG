-- Advanced Link Manager fields (device/geo/AB/password/limits/deep-link/OG/landing/webhooks)

ALTER TABLE public.managed_short_links
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS max_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS expired_redirect_url TEXT,
  ADD COLUMN IF NOT EXISTS folder VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ios_url TEXT,
  ADD COLUMN IF NOT EXISTS android_url TEXT,
  ADD COLUMN IF NOT EXISTS desktop_url TEXT,
  ADD COLUMN IF NOT EXISTS app_deep_link TEXT,
  ADD COLUMN IF NOT EXISTS og_title TEXT,
  ADD COLUMN IF NOT EXISTS og_description TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS enable_landing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS pixel_meta_id TEXT,
  ADD COLUMN IF NOT EXISTS pixel_google_id TEXT;

CREATE INDEX IF NOT EXISTS idx_managed_short_links_folder
  ON public.managed_short_links (folder)
  WHERE folder IS NOT NULL;

COMMENT ON COLUMN public.managed_short_links.password_hash IS 'scrypt salt:hash for password-protected short links';
COMMENT ON COLUMN public.managed_short_links.max_clicks IS 'Stop redirecting after this many clicks (NULL = unlimited)';
COMMENT ON COLUMN public.managed_short_links.enable_landing IS 'Show branded interstitial (deep link / pixels / OG) before destination';

-- Optional API key for external create/bulk (empty = disabled)
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value,
  is_editable
)
VALUES (
  'link_manager_api_key',
  '',
  'STRING',
  'LINK_MANAGER',
  'API key for POST /api/public/link-manager/v1 (create/bulk). Leave empty to disable.',
  '',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
