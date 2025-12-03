-- =====================================================
-- MIGRATION: Enhance Audit Logs for Tech Audit
-- Purpose: Add comprehensive audit logging for tech audit compliance
--          Add security events, API logs, and config change tracking
-- Date: 2025-12-05
-- =====================================================

-- =====================================================
-- 1. ENHANCE audit_logs TABLE
-- =====================================================

-- Add new columns to audit_logs table
ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS action_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(500),
  ADD COLUMN IF NOT EXISTS http_method VARCHAR(10),
  ADD COLUMN IF NOT EXISTS response_status INTEGER,
  ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS error_stack TEXT,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_tamper_proof BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMP WITH TIME ZONE;

-- Add check constraint for severity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'audit_logs_severity_check'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_severity_check 
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;
END $$;

-- Add check constraint for http_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'audit_logs_http_method_check'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_http_method_check 
    CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD') OR http_method IS NULL);
  END IF;
END $$;

-- Set default retention to 7 years from creation
UPDATE public.audit_logs
SET retention_until = created_at + INTERVAL '7 years'
WHERE retention_until IS NULL;

-- Create trigger to auto-set retention_until for new records
CREATE OR REPLACE FUNCTION set_audit_log_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.retention_until IS NULL THEN
    NEW.retention_until := NEW.created_at + INTERVAL '7 years';
  END IF;
  
  -- Calculate data hash if not provided
  IF NEW.data_hash IS NULL THEN
    NEW.data_hash := encode(
      digest(
        COALESCE(NEW.old_data::text, '') || COALESCE(NEW.new_data::text, ''),
        'sha256'
      ),
      'hex'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_audit_log_retention ON public.audit_logs;
CREATE TRIGGER trigger_set_audit_log_retention
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_log_retention();

-- Create trigger to prevent updates/deletes on tamper-proof logs
CREATE OR REPLACE FUNCTION prevent_tamper_proof_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_tamper_proof = true THEN
    RAISE EXCEPTION 'Cannot update tamper-proof audit log: %', OLD.id;
  END IF;
  
  IF TG_OP = 'DELETE' AND OLD.is_tamper_proof = true THEN
    RAISE EXCEPTION 'Cannot delete tamper-proof audit log: %', OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_tamper_proof_log_modification ON public.audit_logs;
CREATE TRIGGER trigger_prevent_tamper_proof_log_modification
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tamper_proof_log_modification();

-- =====================================================
-- 2. CREATE security_events TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  event_details JSONB DEFAULT '{}',
  severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for event_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'security_events_event_type_check'
  ) THEN
    ALTER TABLE public.security_events
    ADD CONSTRAINT security_events_event_type_check 
    CHECK (event_type IN (
      'FAILED_LOGIN',
      'PERMISSION_DENIED',
      'RLS_VIOLATION',
      'SUSPICIOUS_ACTIVITY',
      'UNAUTHORIZED_ACCESS',
      'BRUTE_FORCE_ATTEMPT',
      'SQL_INJECTION_ATTEMPT',
      'XSS_ATTEMPT',
      'CSRF_ATTEMPT',
      'RATE_LIMIT_EXCEEDED',
      'INVALID_TOKEN',
      'SESSION_HIJACK',
      'DATA_BREACH_ATTEMPT',
      'CONFIGURATION_CHANGE',
      'PRIVILEGE_ESCALATION'
    ));
  END IF;
END $$;

-- =====================================================
-- 3. CREATE api_request_logs TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  api_endpoint VARCHAR(500) NOT NULL,
  http_method VARCHAR(10) NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  execution_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE system_config_changes TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.system_config_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  change_reason TEXT,
  approved_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_category_created_at 
  ON public.audit_logs(action_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created_at 
  ON public.audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id 
  ON public.audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id 
  ON public.audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_endpoint 
  ON public.audit_logs(api_endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until 
  ON public.audit_logs(retention_until);

-- Indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_event_type_created_at 
  ON public.security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity_resolved 
  ON public.security_events(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id 
  ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address 
  ON public.security_events(ip_address);

-- Indexes for api_request_logs
CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_endpoint_created_at 
  ON public.api_request_logs(api_endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_id_created_at 
  ON public.api_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_request_id 
  ON public.api_request_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_session_id 
  ON public.api_request_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_response_status 
  ON public.api_request_logs(response_status);

-- Indexes for system_config_changes
CREATE INDEX IF NOT EXISTS idx_system_config_changes_config_key 
  ON public.system_config_changes(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_changes_changed_by 
  ON public.system_config_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_system_config_changes_created_at 
  ON public.system_config_changes(created_at DESC);

-- =====================================================
-- 6. ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE IF EXISTS public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_config_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_events
DROP POLICY IF EXISTS "Super Admins can view all security events" ON public.security_events;
CREATE POLICY "Super Admins can view all security events" ON public.security_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DROP POLICY IF EXISTS "Super Admins can insert security events" ON public.security_events;
CREATE POLICY "Super Admins can insert security events" ON public.security_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
  OR auth.uid() IS NOT NULL -- Allow system to insert
);

DROP POLICY IF EXISTS "Super Admins can update security events" ON public.security_events;
CREATE POLICY "Super Admins can update security events" ON public.security_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- RLS Policies for api_request_logs
DROP POLICY IF EXISTS "Super Admins can view all API logs" ON public.api_request_logs;
CREATE POLICY "Super Admins can view all API logs" ON public.api_request_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DROP POLICY IF EXISTS "System can insert API logs" ON public.api_request_logs;
CREATE POLICY "System can insert API logs" ON public.api_request_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for system_config_changes
DROP POLICY IF EXISTS "Super Admins can view config changes" ON public.system_config_changes;
CREATE POLICY "Super Admins can view config changes" ON public.system_config_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

DROP POLICY IF EXISTS "Super Admins can insert config changes" ON public.system_config_changes;
CREATE POLICY "Super Admins can insert config changes" ON public.system_config_changes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- =====================================================
-- 7. DATA RETENTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION archive_old_audit_logs(
  retention_years INTEGER DEFAULT 7,
  dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
  archived_count BIGINT,
  deleted_count BIGINT,
  export_data JSONB
) AS $$
DECLARE
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
  v_archived_count BIGINT;
  v_deleted_count BIGINT;
  v_export_data JSONB;
BEGIN
  v_cutoff_date := NOW() - (retention_years || ' years')::INTERVAL;
  
  -- Export data before deletion
  SELECT jsonb_agg(row_to_json(t))
  INTO v_export_data
  FROM (
    SELECT * FROM public.audit_logs
    WHERE retention_until < NOW()
    ORDER BY created_at
  ) t;
  
  IF NOT dry_run THEN
    -- Archive old logs (you can create an archive table if needed)
    -- For now, we'll just count them
    SELECT COUNT(*) INTO v_archived_count
    FROM public.audit_logs
    WHERE retention_until < NOW();
    
    -- Delete logs older than retention period
    -- Note: This will fail for tamper-proof logs due to trigger
    DELETE FROM public.audit_logs
    WHERE retention_until < NOW()
    AND is_tamper_proof = false;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSE
    SELECT COUNT(*) INTO v_archived_count
    FROM public.audit_logs
    WHERE retention_until < NOW();
    v_deleted_count := 0;
  END IF;
  
  RETURN QUERY SELECT v_archived_count, v_deleted_count, v_export_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. DATA INTEGRITY VERIFICATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION verify_audit_log_integrity(
  p_log_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  log_id UUID,
  is_valid BOOLEAN,
  expected_hash VARCHAR(64),
  actual_hash VARCHAR(64),
  tampered BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id AS log_id,
    al.data_hash = encode(
      digest(
        COALESCE(al.old_data::text, '') || COALESCE(al.new_data::text, ''),
        'sha256'
      ),
      'hex'
    ) AS is_valid,
    al.data_hash AS expected_hash,
    encode(
      digest(
        COALESCE(al.old_data::text, '') || COALESCE(al.new_data::text, ''),
        'sha256'
      ),
      'hex'
    ) AS actual_hash,
    al.data_hash != encode(
      digest(
        COALESCE(al.old_data::text, '') || COALESCE(al.new_data::text, ''),
        'sha256'
      ),
      'hex'
    ) AS tampered
  FROM public.audit_logs al
  WHERE (p_log_id IS NULL OR al.id = p_log_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON COLUMN public.audit_logs.action_category IS 'Category of action: SECURITY, DATA, CONFIG, API, ERROR, etc.';
COMMENT ON COLUMN public.audit_logs.severity IS 'Risk level: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN public.audit_logs.session_id IS 'User session identifier for tracking';
COMMENT ON COLUMN public.audit_logs.api_endpoint IS 'API route that triggered the action';
COMMENT ON COLUMN public.audit_logs.data_hash IS 'SHA-256 hash of old_data + new_data for integrity verification';
COMMENT ON COLUMN public.audit_logs.is_tamper_proof IS 'If true, prevents updates/deletes for compliance';
COMMENT ON COLUMN public.audit_logs.retention_until IS 'Date until which this log must be retained (default 7 years)';

COMMENT ON TABLE public.security_events IS 'Security-specific events for audit and compliance';
COMMENT ON TABLE public.api_request_logs IS 'Comprehensive API request/response logging for audit';
COMMENT ON TABLE public.system_config_changes IS 'Track all system configuration changes';

DO $$
BEGIN
    RAISE NOTICE '✅ Audit logs enhanced for tech audit compliance!';
    RAISE NOTICE 'ℹ️  Added new columns to audit_logs table';
    RAISE NOTICE 'ℹ️  Created security_events table';
    RAISE NOTICE 'ℹ️  Created api_request_logs table';
    RAISE NOTICE 'ℹ️  Created system_config_changes table';
    RAISE NOTICE 'ℹ️  Added indexes for performance';
    RAISE NOTICE 'ℹ️  Added RLS policies';
    RAISE NOTICE 'ℹ️  Created data retention and integrity functions';
END $$;

