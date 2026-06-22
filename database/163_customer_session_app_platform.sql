-- Store app platform on each login session (reliable vs okhttp user-agent on Android)
ALTER TABLE public.customer_sessions
  ADD COLUMN IF NOT EXISTS app_platform VARCHAR(10);

COMMENT ON COLUMN public.customer_sessions.app_platform IS 'App platform at login: ANDROID or IOS';

CREATE INDEX IF NOT EXISTS idx_customer_sessions_app_platform ON public.customer_sessions(app_platform);

-- Backfill sessions from user-agent (React Native Android often sends okhttp only)
UPDATE public.customer_sessions
SET app_platform = 'ANDROID'
WHERE app_platform IS NULL
  AND user_agent IS NOT NULL
  AND (
    lower(user_agent) LIKE '%android%'
    OR lower(user_agent) LIKE '%okhttp%'
    OR lower(user_agent) LIKE '%dalvik%'
  );

UPDATE public.customer_sessions
SET app_platform = 'IOS'
WHERE app_platform IS NULL
  AND user_agent IS NOT NULL
  AND (
    lower(user_agent) LIKE '%iphone%'
    OR lower(user_agent) LIKE '%ipad%'
    OR lower(user_agent) LIKE '%ipod%'
    OR lower(user_agent) LIKE '%cfnetwork%'
    OR lower(user_agent) LIKE '%cpu iphone os%'
  );

-- Backfill customers from their latest session with a known platform
UPDATE public.customers c
SET app_platform = latest.app_platform,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    app_platform
  FROM public.customer_sessions
  WHERE app_platform IS NOT NULL
  ORDER BY customer_id, created_at DESC
) latest
WHERE c.id = latest.customer_id
  AND (c.app_platform IS NULL OR c.app_platform = '');
