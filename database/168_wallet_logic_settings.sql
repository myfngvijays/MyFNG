-- Wallet logic settings for admin-configurable rules (App + web checkout)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_service_usage_percent', '10', 'NUMBER', 'WALLET', 'Max % of service payable amount usable from wallet at checkout', '10', true),
  ('wallet_membership_usage_percent', '30', 'NUMBER', 'WALLET', 'Max % of membership payable amount usable from wallet at checkout', '30', true),
  ('wallet_welcome_bonus_amount', '1000', 'NUMBER', 'WALLET', 'Welcome bonus credited on first app login (INR)', '1000', true),
  ('wallet_welcome_expiry_days', '90', 'NUMBER', 'WALLET', 'Days until unused welcome bonus expires', '90', true),
  ('wallet_membership_cashback_rate_percent', '5', 'NUMBER', 'WALLET', 'Prime member cashback % on paid service bills', '5', true),
  ('wallet_membership_cashback_max', '500', 'NUMBER', 'WALLET', 'Max Prime cashback per paid bill (INR)', '500', true)
ON CONFLICT (setting_key) DO NOTHING;
