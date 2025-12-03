-- =====================================================
-- MIGRATION: Add Sample Audit Logs for Testing
-- Purpose: Insert sample audit logs to test the audit system
-- Date: 2025-12-05
-- =====================================================

-- Insert sample audit logs (only if table is empty)
DO $$
DECLARE
  v_log_count INTEGER;
  v_super_admin_id UUID;
BEGIN
  -- Check if audit_logs table is empty
  SELECT COUNT(*) INTO v_log_count FROM public.audit_logs;
  
  -- Get a Super Admin user ID (if exists)
  SELECT ul.id INTO v_super_admin_id
  FROM public.users_login ul
  JOIN public.roles r ON ul.role_id = r.id
  WHERE r.role_code = 'SUPER_ADMIN'
  LIMIT 1;
  
  -- Only insert if table is empty
  IF v_log_count = 0 THEN
    -- Sample audit logs with various action types
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      ip_address,
      user_agent,
      action_category,
      severity,
      api_endpoint,
      http_method,
      response_status,
      execution_time_ms,
      compliance_flags,
      data_hash,
      is_tamper_proof,
      created_at
    ) VALUES
    -- Login event
    (
      v_super_admin_id,
      'LOGIN',
      'users_login',
      v_super_admin_id,
      NULL,
      jsonb_build_object('last_login', NOW()),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'SECURITY',
      'MEDIUM',
      '/api/auth/login',
      'POST',
      200,
      150,
      jsonb_build_object('soc2_relevant', true, 'iso27001_relevant', true),
      encode(digest('' || jsonb_build_object('last_login', NOW())::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '2 days'
    ),
    -- User creation
    (
      v_super_admin_id,
      'CREATE',
      'users_login',
      gen_random_uuid(),
      NULL,
      jsonb_build_object('email', 'test@example.com', 'role', 'WORKSHOP_ADMIN'),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'DATA',
      'MEDIUM',
      '/api/admin/users',
      'POST',
      201,
      250,
      jsonb_build_object('gdpr_relevant', true, 'iso27001_relevant', true),
      encode(digest('' || jsonb_build_object('email', 'test@example.com')::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '1 day'
    ),
    -- Workshop update
    (
      v_super_admin_id,
      'UPDATE',
      'workshops',
      gen_random_uuid(),
      jsonb_build_object('name', 'Old Workshop Name'),
      jsonb_build_object('name', 'New Workshop Name', 'zone_id', gen_random_uuid()),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'DATA',
      'MEDIUM',
      '/api/admin/workshops/123',
      'PUT',
      200,
      180,
      jsonb_build_object('iso27001_relevant', true),
      encode(digest(jsonb_build_object('name', 'Old Workshop Name')::text || jsonb_build_object('name', 'New Workshop Name')::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '12 hours'
    ),
    -- Configuration change
    (
      v_super_admin_id,
      'SETTINGS_CHANGE',
      'system_settings',
      gen_random_uuid(),
      jsonb_build_object('max_users', 100),
      jsonb_build_object('max_users', 200),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'CONFIG',
      'HIGH',
      '/api/admin/settings',
      'PUT',
      200,
      120,
      jsonb_build_object('soc2_relevant', true, 'iso27001_relevant', true),
      encode(digest(jsonb_build_object('max_users', 100)::text || jsonb_build_object('max_users', 200)::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '6 hours'
    ),
    -- Lead creation
    (
      v_super_admin_id,
      'CREATE',
      'service_leads',
      gen_random_uuid(),
      NULL,
      jsonb_build_object('lead_number', 'LD-001', 'status', 'NEW'),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'DATA',
      'LOW',
      '/api/leads',
      'POST',
      201,
      300,
      jsonb_build_object('iso27001_relevant', true),
      encode(digest('' || jsonb_build_object('lead_number', 'LD-001')::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '3 hours'
    ),
    -- Error event
    (
      v_super_admin_id,
      'UPDATE',
      'service_leads',
      gen_random_uuid(),
      jsonb_build_object('status', 'PENDING'),
      jsonb_build_object('status', 'PENDING'),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'ERROR',
      'HIGH',
      '/api/leads/123/update',
      'PUT',
      500,
      5000,
      jsonb_build_object('iso27001_relevant', true),
      encode(digest(jsonb_build_object('status', 'PENDING')::text || jsonb_build_object('status', 'PENDING')::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '1 hour'
    ),
    -- Export action
    (
      v_super_admin_id,
      'EXPORT',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('export_type', 'audit_logs', 'format', 'csv'),
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'DATA',
      'LOW',
      '/api/audit/logs',
      'GET',
      200,
      450,
      jsonb_build_object('iso27001_relevant', true),
      encode(digest('' || jsonb_build_object('export_type', 'audit_logs')::text, 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '30 minutes'
    ),
    -- Delete action (critical)
    (
      v_super_admin_id,
      'DELETE',
      'notifications',
      gen_random_uuid(),
      jsonb_build_object('id', gen_random_uuid(), 'message', 'Test notification'),
      NULL,
      '192.168.1.100',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'DATA',
      'HIGH',
      '/api/notifications/123',
      'DELETE',
      200,
      80,
      jsonb_build_object('iso27001_relevant', true),
      encode(digest(jsonb_build_object('id', gen_random_uuid())::text || '', 'sha256'), 'hex'),
      true,
      NOW() - INTERVAL '15 minutes'
    );
    
    RAISE NOTICE '✅ Sample audit logs inserted successfully!';
    RAISE NOTICE 'ℹ️  Inserted 8 sample audit log entries for testing.';
  ELSE
    RAISE NOTICE 'ℹ️  Audit logs table already contains data. Skipping sample data insertion.';
  END IF;
END $$;

