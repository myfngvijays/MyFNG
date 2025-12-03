-- =====================================================
-- MIGRATION: Fix Audit Logs RLS Policies
-- Purpose: Allow Super Admins to view audit logs
--          Ensure audit_logs table has proper RLS policies
-- Date: 2025-12-05
-- =====================================================

-- Ensure RLS is enabled for audit_logs table
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Policy: Super Admins can view all audit logs
CREATE POLICY "Super Admins can view all audit logs" ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Users can view their own audit logs (optional, for transparency)
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Policy: System can insert audit logs (via SECURITY DEFINER function)
-- Note: The log_audit_event function uses SECURITY DEFINER, so it can insert
-- without RLS restrictions. But we still need a policy for direct inserts.
CREATE POLICY "System can insert audit logs" ON public.audit_logs
FOR INSERT
WITH CHECK (
  -- Allow if user is authenticated (for API routes)
  auth.uid() IS NOT NULL
  OR
  -- Allow if inserted by system function (SECURITY DEFINER)
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies for audit_logs table fixed!';
    RAISE NOTICE 'ℹ️  Super Admins can now view all audit logs.';
    RAISE NOTICE 'ℹ️  Users can view their own audit logs.';
    RAISE NOTICE 'ℹ️  System can insert audit logs via API or functions.';
END $$;

