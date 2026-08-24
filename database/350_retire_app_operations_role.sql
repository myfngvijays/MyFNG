-- Retire APP_OPERATIONS — features now live on Lead Manager.
-- Safe to re-run.

UPDATE public.users_login
SET role_id = lm.id, updated_at = NOW()
FROM public.roles ao, public.roles lm
WHERE ao.role_code = 'APP_OPERATIONS'
  AND lm.role_code = 'LEAD_MANAGER'
  AND users_login.role_id = ao.id;

UPDATE public.roles
SET
  is_active = false,
  description = 'Deprecated — App Operations moved to Lead Manager',
  updated_at = NOW()
WHERE role_code = 'APP_OPERATIONS';
