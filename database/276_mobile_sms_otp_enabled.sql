-- Mobile app login: SMS OTP on/off (controlled from Super Admin → Settings)
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value
) VALUES (
  'mobile_sms_otp_enabled',
  'false',
  'BOOLEAN',
  'MOBILE_APP',
  'Allow SMS OTP login in Android/iOS app (Firebase Phone Auth). WhatsApp OTP is unaffected.',
  'false'
)
ON CONFLICT (setting_key) DO NOTHING;
