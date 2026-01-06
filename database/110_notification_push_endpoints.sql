-- ============================================================
-- 110_notification_push_endpoints.sql
-- Final notifications: store device tokens + web push subscriptions
-- ============================================================

-- 1) Device tokens (Expo / FCM / etc)
CREATE TABLE IF NOT EXISTS public.notification_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'EXPO' (mobile), can extend later
  token TEXT NOT NULL,
  device_id TEXT NULL,
  device_name TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notification_devices UNIQUE (user_id, platform, token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id ON public.notification_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_devices_active ON public.notification_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_devices_platform ON public.notification_devices(platform);

-- 2) Web Push subscriptions (VAPID)
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time BIGINT NULL,
  user_agent TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_web_push_sub UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON public.web_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_active ON public.web_push_subscriptions(is_active);

-- 3) updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notification_devices_updated_at') THEN
    CREATE TRIGGER trg_notification_devices_updated_at
      BEFORE UPDATE ON public.notification_devices
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_web_push_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_web_push_subscriptions_updated_at
      BEFORE UPDATE ON public.web_push_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 4) RLS
ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage their own tokens/subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_devices' AND policyname='Users can manage their own notification devices') THEN
    CREATE POLICY "Users can manage their own notification devices"
      ON public.notification_devices
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='web_push_subscriptions' AND policyname='Users can manage their own web push subscriptions') THEN
    CREATE POLICY "Users can manage their own web push subscriptions"
      ON public.web_push_subscriptions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_devices TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated, service_role;


