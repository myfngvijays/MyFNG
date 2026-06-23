-- Wallet usage mode: PERCENT or fixed AMOUNT (INR)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_service_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'Service wallet limit type: PERCENT or AMOUNT', 'PERCENT', true),
  ('wallet_service_usage_amount', '500', 'NUMBER', 'WALLET', 'Service wallet fixed max (INR) when mode is AMOUNT', '500', true),
  ('wallet_membership_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'Membership wallet limit type: PERCENT or AMOUNT', 'PERCENT', true),
  ('wallet_membership_usage_amount', '210', 'NUMBER', 'WALLET', 'Membership wallet fixed max (INR) when mode is AMOUNT', '210', true),

  ('wallet_android_service_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'Android service wallet limit type', 'PERCENT', true),
  ('wallet_android_service_usage_amount', '500', 'NUMBER', 'WALLET', 'Android service wallet fixed max (INR)', '500', true),
  ('wallet_android_membership_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'Android membership wallet limit type', 'PERCENT', true),
  ('wallet_android_membership_usage_amount', '210', 'NUMBER', 'WALLET', 'Android membership wallet fixed max (INR)', '210', true),

  ('wallet_ios_service_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'iOS service wallet limit type', 'PERCENT', true),
  ('wallet_ios_service_usage_amount', '500', 'NUMBER', 'WALLET', 'iOS service wallet fixed max (INR)', '500', true),
  ('wallet_ios_membership_usage_mode', 'PERCENT', 'STRING', 'WALLET', 'iOS membership wallet limit type', 'PERCENT', true),
  ('wallet_ios_membership_usage_amount', '210', 'NUMBER', 'WALLET', 'iOS membership wallet fixed max (INR)', '210', true)
ON CONFLICT (setting_key) DO NOTHING;