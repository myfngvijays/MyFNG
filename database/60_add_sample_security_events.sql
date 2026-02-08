-- =====================================================
-- Add sample security events for testing
-- Run after 58_enhance_audit_logs_for_tech_audit.sql (creates security_events table)
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
  v_admin_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.security_events;

  IF v_count > 0 THEN
    RAISE NOTICE 'ℹ️ security_events already has data, skipping sample insert.';
    RETURN;
  END IF;

  SELECT ul.id INTO v_admin_id
  FROM public.users_login ul
  JOIN public.roles r ON ul.role_id = r.id
  WHERE r.role_code = 'SUPER_ADMIN'
  LIMIT 1;

  INSERT INTO public.security_events (
    event_type, user_id, ip_address, user_agent, event_details, severity, resolved, created_at
  ) VALUES
  (
    'FAILED_LOGIN',
    v_admin_id,
    '192.168.1.10',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '{"reason": "Invalid password", "email": "test@example.com"}'::jsonb,
    'MEDIUM',
    false,
    NOW() - INTERVAL '5 days'
  ),
  (
    'PERMISSION_DENIED',
    v_admin_id,
    '10.0.0.5',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    '{"resource": "/api/admin/users", "method": "GET"}'::jsonb,
    'LOW',
    true,
    NOW() - INTERVAL '4 days'
  ),
  (
    'RATE_LIMIT_EXCEEDED',
    NULL,
    '203.0.113.42',
    'PostmanRuntime/7.29.0',
    '{"endpoint": "/api/auth/login", "count": 15}'::jsonb,
    'MEDIUM',
    false,
    NOW() - INTERVAL '3 days'
  ),
  (
    'INVALID_TOKEN',
    v_admin_id,
    '192.168.1.20',
    'Mozilla/5.0 (X11; Linux x86_64)',
    '{"token_type": "refresh"}'::jsonb,
    'LOW',
    true,
    NOW() - INTERVAL '2 days'
  ),
  (
    'SUSPICIOUS_ACTIVITY',
    v_admin_id,
    '198.51.100.1',
    'curl/7.68.0',
    '{"note": "Multiple failed attempts from same IP"}'::jsonb,
    'HIGH',
    false,
    NOW() - INTERVAL '1 day'
  ),
  (
    'UNAUTHORIZED_ACCESS',
    NULL,
    '192.168.2.100',
    'Python-requests/2.28.0',
    '{"path": "/api/super_admin/dashboard"}'::jsonb,
    'HIGH',
    false,
    NOW() - INTERVAL '12 hours'
  );

  RAISE NOTICE '✅ Inserted 6 sample security events.';
END $$;
