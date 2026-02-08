-- =====================================================
-- Add sample system configuration changes for testing
-- Run after 58_enhance_audit_logs_for_tech_audit.sql (creates system_config_changes table)
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
  v_admin_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.system_config_changes;

  IF v_count > 0 THEN
    RAISE NOTICE 'ℹ️ system_config_changes already has data, skipping sample insert.';
    RETURN;
  END IF;

  SELECT ul.id INTO v_admin_id
  FROM public.users_login ul
  JOIN public.roles r ON ul.role_id = r.id
  WHERE r.role_code = 'SUPER_ADMIN'
  LIMIT 1;

  INSERT INTO public.system_config_changes (
    config_key, old_value, new_value, changed_by, change_reason, ip_address, created_at
  ) VALUES
  (
    'app.maintenance_mode',
    'false',
    'true',
    v_admin_id,
    'Scheduled maintenance window',
    '192.168.1.10',
    NOW() - INTERVAL '5 days'
  ),
  (
    'auth.max_login_attempts',
    '5',
    '10',
    v_admin_id,
    'Increase limit for support team',
    NULL,
    NOW() - INTERVAL '4 days'
  ),
  (
    'sms.provider',
    'twilio',
    'msg91',
    v_admin_id,
    'Switch to regional provider',
    '10.0.0.5',
    NOW() - INTERVAL '3 days'
  ),
  (
    'app.maintenance_mode',
    'true',
    'false',
    v_admin_id,
    'Maintenance complete',
    '192.168.1.10',
    NOW() - INTERVAL '2 days'
  ),
  (
    'feature.workshop_locator_enabled',
    NULL,
    'true',
    v_admin_id,
    'Enable new workshop locator',
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  (
    'pricing.default_margin_percent',
    '15',
    '18',
    v_admin_id,
    'Annual pricing review',
    '203.0.113.1',
    NOW() - INTERVAL '6 hours'
  );

  RAISE NOTICE '✅ Inserted 6 sample system configuration changes.';
END $$;

-- Optional: allow SUB_ADMIN to view config changes (API already allows SUB_ADMIN)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_config_changes'
    AND policyname = 'Sub Admins can view config changes'
  ) THEN
    CREATE POLICY "Sub Admins can view config changes" ON public.system_config_changes
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.users_login ul
        JOIN public.roles r ON ul.role_id = r.id
        WHERE ul.id = auth.uid()
        AND r.role_code = 'SUB_ADMIN'
      )
    );
    RAISE NOTICE '✅ Added RLS policy for SUB_ADMIN to view config changes.';
  END IF;
END $$;
