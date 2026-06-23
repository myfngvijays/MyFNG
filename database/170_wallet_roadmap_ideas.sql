-- Wallet roadmap / future logic ideas (admin-managed backlog)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'wallet_roadmap_ideas',
    '[{"id":"default-1","title":"Festival bonus campaigns","desc":"Time-bound extra wallet credits (Diwali, New Year)","status":"planned"},{"id":"default-2","title":"City-wise wallet caps","desc":"Different % limits per zone or workshop","status":"planned"},{"id":"default-3","title":"Prime tier multipliers","desc":"Gold vs Prime — higher cashback tiers","status":"planned"},{"id":"default-4","title":"RSA wallet usage","desc":"Separate % for roadside assistance bookings","status":"planned"},{"id":"default-5","title":"Wallet + coupon stacking","desc":"Control if wallet works with coupons together","status":"planned"}]',
    'JSON',
    'WALLET',
    'Admin backlog of wallet logic ideas to implement later',
    '[]',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
