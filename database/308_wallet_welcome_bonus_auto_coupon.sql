-- Welcome bonus phone overrides: setting key for auto-assign coupon id
-- Coupon itself + wiring: run 309_welcome_car_inspection_coupon.sql

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
  'wallet_welcome_bonus_auto_coupon_id',
  '',
  'STRING',
  'WALLET',
  'Coupon UUID auto-assigned to customers on the welcome bonus phone-override list (appears in My Coupons).',
  '',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
