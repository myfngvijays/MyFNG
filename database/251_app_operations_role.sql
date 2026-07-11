-- APP_OPERATIONS: limited admin panel for bookings, app customers & referral
INSERT INTO public.roles (role_code, role_name, description, permissions, is_active)
VALUES (
  'APP_OPERATIONS',
  'App Operations',
  'Manages service bookings & leads, app customers, and refer & earn programs',
  '{
    "view_leads": true,
    "manage_leads": true,
    "view_customers": true,
    "manage_referrals": true
  }'::jsonb,
  true
)
ON CONFLICT (role_code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
