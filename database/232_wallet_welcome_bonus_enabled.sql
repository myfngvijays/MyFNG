-- Admin toggle: enable/disable welcome bonus credit on app login.
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_welcome_bonus_enabled', 'true', 'BOOLEAN', 'WALLET', 'When false, new app users do not receive welcome wallet bonus', 'true', true),
  ('wallet_android_welcome_bonus_enabled', 'true', 'BOOLEAN', 'WALLET', 'Android: welcome bonus on/off (when not using default rules)', 'true', true),
  ('wallet_ios_welcome_bonus_enabled', 'true', 'BOOLEAN', 'WALLET', 'iOS: welcome bonus on/off (when not using default rules)', 'true', true)
ON CONFLICT (setting_key) DO NOTHING;
