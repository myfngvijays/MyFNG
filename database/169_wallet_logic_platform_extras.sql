-- Platform-specific wallet overrides + referral & limit settings

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_referral_first_reward', '500', 'NUMBER', 'WALLET', 'Referral reward for first successful referral (INR)', '500', true),
  ('wallet_referral_repeat_reward', '250', 'NUMBER', 'WALLET', 'Referral reward for every next referral (INR)', '250', true),
  ('wallet_min_payable_for_wallet', '0', 'NUMBER', 'WALLET', 'Minimum payable amount required to use wallet (0 = no minimum)', '0', true),
  ('wallet_max_absolute_deduction', '0', 'NUMBER', 'WALLET', 'Max wallet deduction per checkout in INR (0 = no cap, only % applies)', '0', true),

  ('wallet_android_use_global', 'true', 'BOOLEAN', 'WALLET', 'Android app inherits default/web wallet rules', 'true', true),
  ('wallet_android_enabled', 'true', 'BOOLEAN', 'WALLET', 'Wallet enabled on Android app', 'true', true),
  ('wallet_android_service_usage_percent', '10', 'NUMBER', 'WALLET', 'Android: max % of service bill from wallet', '10', true),
  ('wallet_android_membership_usage_percent', '30', 'NUMBER', 'WALLET', 'Android: max % of membership from wallet', '30', true),
  ('wallet_android_welcome_bonus_amount', '1000', 'NUMBER', 'WALLET', 'Android: welcome bonus amount', '1000', true),
  ('wallet_android_welcome_expiry_days', '90', 'NUMBER', 'WALLET', 'Android: welcome bonus expiry days', '90', true),
  ('wallet_android_membership_cashback_rate_percent', '5', 'NUMBER', 'WALLET', 'Android: Prime cashback rate %', '5', true),
  ('wallet_android_membership_cashback_max', '500', 'NUMBER', 'WALLET', 'Android: max cashback per bill', '500', true),

  ('wallet_ios_use_global', 'true', 'BOOLEAN', 'WALLET', 'iOS app inherits default/web wallet rules', 'true', true),
  ('wallet_ios_enabled', 'true', 'BOOLEAN', 'WALLET', 'Wallet enabled on iOS app', 'true', true),
  ('wallet_ios_service_usage_percent', '10', 'NUMBER', 'WALLET', 'iOS: max % of service bill from wallet', '10', true),
  ('wallet_ios_membership_usage_percent', '30', 'NUMBER', 'WALLET', 'iOS: max % of membership from wallet', '30', true),
  ('wallet_ios_welcome_bonus_amount', '1000', 'NUMBER', 'WALLET', 'iOS: welcome bonus amount', '1000', true),
  ('wallet_ios_welcome_expiry_days', '90', 'NUMBER', 'WALLET', 'iOS: welcome bonus expiry days', '90', true),
  ('wallet_ios_membership_cashback_rate_percent', '5', 'NUMBER', 'WALLET', 'iOS: Prime cashback rate %', '5', true),
  ('wallet_ios_membership_cashback_max', '500', 'NUMBER', 'WALLET', 'iOS: max cashback per bill', '500', true)
ON CONFLICT (setting_key) DO NOTHING;
