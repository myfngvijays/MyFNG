-- Welcome bonus: per-phone amount overrides (e.g. selected numbers get ₹1500, others keep default ₹1000)

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
  'wallet_welcome_bonus_phone_overrides',
  '[]',
  'JSON',
  'WALLET',
  'JSON array of {phone, amount}. Matching customers get this welcome bonus instead of the global amount.',
  '[]',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
