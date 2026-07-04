-- Per-source wallet usage limits
-- Allows setting different wallet usage percentages for each funding source
-- (welcome_bonus, referral, membership_cashback, admin_credit)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_per_source_limits_enabled', 'false', 'BOOLEAN', 'WALLET', 'When enabled, each wallet source (welcome, referral, cashback, admin) gets its own usage percentage', 'false', true),
  ('wallet_source_limits', '{"welcome_bonus":{"service_percent":10,"membership_percent":30},"referral":{"service_percent":10,"membership_percent":30},"membership_cashback":{"service_percent":10,"membership_percent":30},"admin_credit":{"service_percent":10,"membership_percent":30}}', 'JSON', 'WALLET', 'JSON object with per-source service and membership usage percentages', '{}', true)
ON CONFLICT (setting_key) DO NOTHING;
