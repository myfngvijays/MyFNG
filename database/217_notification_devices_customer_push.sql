-- 217_notification_devices_customer_push.sql
-- Store Expo push tokens for customer app users (OTP login) alongside staff users_login tokens.

ALTER TABLE public.notification_devices
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.notification_devices
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notification_devices_customer_id
  ON public.notification_devices(customer_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_customer_active
  ON public.notification_devices(customer_id, is_active)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_devices_customer_platform_token
  ON public.notification_devices(customer_id, platform, token)
  WHERE customer_id IS NOT NULL;
