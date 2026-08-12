-- Special welcome (phone override) wallet usage rules: percent and/or fixed ₹ + per-service

INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value,
  is_editable
)
VALUES (
  'wallet_welcome_bonus_override_usage',
  '{"enabled":false,"service_usage_mode":"AMOUNT","service_usage_percent":10,"service_usage_amount":500,"membership_usage_mode":"PERCENT","membership_usage_percent":30,"membership_usage_amount":210,"service_type_rules":[]}',
  'JSON',
  'WALLET',
  'Wallet spend rules for welcome phone-override users: default percent/amount + optional per service_type rules.',
  '{"enabled":false,"service_usage_mode":"AMOUNT","service_usage_percent":10,"service_usage_amount":500,"membership_usage_mode":"PERCENT","membership_usage_percent":30,"membership_usage_amount":210,"service_type_rules":[]}',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
