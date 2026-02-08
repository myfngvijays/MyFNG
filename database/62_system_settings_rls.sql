-- =====================================================
-- RLS policies for system_settings (Super Admin settings page)
-- Allows SUPER_ADMIN and SUB_ADMIN to read; only SUPER_ADMIN to update
-- =====================================================

ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (by name pattern used elsewhere)
DROP POLICY IF EXISTS "Super Admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Sub Admins can view system settings" ON public.system_settings;

-- Super Admin: full access
CREATE POLICY "Super Admins can view system settings" ON public.system_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

CREATE POLICY "Super Admins can update system settings" ON public.system_settings
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Sub Admin: read-only (optional; remove if only Super Admin should see)
CREATE POLICY "Sub Admins can view system settings" ON public.system_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUB_ADMIN'
  )
);
