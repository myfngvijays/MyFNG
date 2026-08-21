-- Enrich login history for manager audit: where / when / how often telecallers log in
ALTER TABLE public.user_login_history
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS device_label TEXT;

COMMENT ON COLUMN public.user_login_history.ip_address IS 'Client IP from proxy headers (best-effort)';
COMMENT ON COLUMN public.user_login_history.location_label IS 'Human-readable place from GPS or IP geo';
COMMENT ON COLUMN public.user_login_history.device_label IS 'Short device / browser label';

CREATE INDEX IF NOT EXISTS idx_user_login_history_logged_in_at
  ON public.user_login_history (logged_in_at DESC);
