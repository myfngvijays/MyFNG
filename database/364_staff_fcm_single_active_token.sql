-- 364_staff_fcm_single_active_token.sql
-- Staff FCM: keep one active token per user, deactivate stale installs.
-- Fixes leftover tokens from repeated logins without device_name / deactivate.

CREATE OR REPLACE FUNCTION public.register_staff_fcm_token(
  p_fcm_token TEXT,
  p_device_name TEXT DEFAULT 'Android',
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token TEXT;
  v_device TEXT;
  v_device_id TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_existing_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users_login ul WHERE ul.id = v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  v_token := trim(coalesce(p_fcm_token, ''));
  IF length(v_token) < 20 OR length(v_token) > 4096 OR position(' ' in v_token) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_token LIKE 'ExponentPushToken[%' OR v_token LIKE 'ExpoPushToken[%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expo_token_not_supported');
  END IF;

  v_device := left(trim(coalesce(p_device_name, 'Android')), 120);
  v_device_id := nullif(left(trim(coalesce(p_device_id, '')), 120), '');

  UPDATE public.notification_devices
  SET is_active = false,
      updated_at = v_now
  WHERE user_id = v_user_id
    AND platform = 'FCM'
    AND token <> v_token
    AND is_active = true;

  SELECT nd.id
    INTO v_existing_id
  FROM public.notification_devices nd
  WHERE nd.user_id = v_user_id
    AND nd.platform = 'FCM'
    AND nd.token = v_token
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.notification_devices
    SET is_active = true,
        last_seen_at = v_now,
        device_name = v_device,
        device_id = COALESCE(v_device_id, device_id),
        updated_at = v_now
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.notification_devices (
      user_id,
      customer_id,
      platform,
      token,
      device_name,
      device_id,
      is_active,
      last_seen_at
    ) VALUES (
      v_user_id,
      NULL,
      'FCM',
      v_token,
      v_device,
      v_device_id,
      true,
      v_now
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'registered', true, 'platform', 'FCM');
END;
$$;

REVOKE ALL ON FUNCTION public.register_staff_fcm_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_staff_fcm_token(TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notification_devices_single_active_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.is_active = true AND upper(coalesce(NEW.platform, '')) = 'FCM' THEN
    UPDATE public.notification_devices
    SET is_active = false,
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND platform = NEW.platform
      AND id <> NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_devices_single_active_staff ON public.notification_devices;
CREATE TRIGGER trg_notification_devices_single_active_staff
  AFTER INSERT OR UPDATE OF is_active, token, user_id
  ON public.notification_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_devices_single_active_staff();
