-- 218_register_customer_fcm_token_rpc.sql
-- Lets mobile app register FCM tokens without the Next.js push-token API (no VPS deploy needed).

CREATE OR REPLACE FUNCTION public.register_customer_fcm_token(
  p_session_token TEXT,
  p_fcm_token TEXT,
  p_device_name TEXT DEFAULT 'Android'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_token TEXT;
  v_device TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_existing_id UUID;
BEGIN
  SELECT cs.customer_id
    INTO v_customer_id
  FROM public.customer_sessions cs
  WHERE cs.token = trim(p_session_token)
    AND cs.expires_at > v_now
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_token := trim(coalesce(p_fcm_token, ''));
  IF length(v_token) < 20 OR length(v_token) > 4096 OR position(' ' in v_token) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_token LIKE 'ExponentPushToken[%' OR v_token LIKE 'ExpoPushToken[%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expo_token_not_supported');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_notification_preferences p
    WHERE p.customer_id = v_customer_id
      AND p.push_enabled = false
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'push_disabled');
  END IF;

  v_device := left(trim(coalesce(p_device_name, 'Android')), 120);

  SELECT nd.id
    INTO v_existing_id
  FROM public.notification_devices nd
  WHERE nd.customer_id = v_customer_id
    AND nd.platform = 'FCM'
    AND nd.token = v_token
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.notification_devices
    SET is_active = true,
        last_seen_at = v_now,
        device_name = v_device,
        updated_at = v_now
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.notification_devices (
      customer_id,
      user_id,
      platform,
      token,
      device_name,
      is_active,
      last_seen_at
    ) VALUES (
      v_customer_id,
      NULL,
      'FCM',
      v_token,
      v_device,
      true,
      v_now
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'registered', true, 'platform', 'FCM');
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_fcm_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_fcm_token(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.register_customer_fcm_token IS
  'Register customer FCM push token using OTP session token (mobile fallback when web API unavailable).';
