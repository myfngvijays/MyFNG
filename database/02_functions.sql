-- ============================================
-- MyFNG Database Functions
-- All database functions and stored procedures
-- ============================================

-- Function to generate lead number
CREATE OR REPLACE FUNCTION generate_lead_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
  new_lead_number TEXT;
BEGIN
  -- Determine prefix based on lead type
  CASE NEW.lead_type
    WHEN 'NORMAL' THEN prefix := 'LN';
    WHEN 'RSA' THEN prefix := 'RSA';
    WHEN 'HOME_SERVICE' THEN prefix := 'HS';
    ELSE prefix := 'LN';
  END CASE;

  -- Get the next number for this lead type
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(lead_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM service_leads
  WHERE lead_number LIKE prefix || '%';

  -- Generate new lead number with padding
  new_lead_number := prefix || LPAD(next_num::TEXT, 6, '0');
  
  NEW.lead_number := new_lead_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate pickup task number
CREATE OR REPLACE FUNCTION generate_pickup_task_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
  new_task_number TEXT;
BEGIN
  -- Determine prefix based on task type
  CASE NEW.task_type
    WHEN 'PICKUP' THEN prefix := 'PU';
    WHEN 'DELIVERY' THEN prefix := 'DL';
    WHEN 'BOTH' THEN prefix := 'PD';
    ELSE prefix := 'PU';
  END CASE;

  -- Get the next number
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(task_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM pickup_delivery_tasks
  WHERE task_number LIKE prefix || '%';

  -- Generate new task number
  new_task_number := prefix || LPAD(next_num::TEXT, 6, '0');
  
  NEW.task_number := new_task_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log lead activity
CREATE OR REPLACE FUNCTION log_lead_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (
      lead_id,
      user_id,
      activity_type,
      description,
      old_status,
      new_status,
      metadata
    ) VALUES (
      NEW.id,
      NEW.updated_by_id,
      'STATUS_CHANGE',
      'Lead status changed from ' || OLD.status || ' to ' || NEW.status,
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'old_assigned_to', OLD.assigned_to_id,
        'new_assigned_to', NEW.assigned_to_id,
        'old_workshop', OLD.workshop_id,
        'new_workshop', NEW.workshop_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit events (GDPR Compliance)
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id uuid,
  p_action character varying,
  p_table_name character varying,
  p_record_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_ip_address character varying DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role_code character varying;
BEGIN
  SELECT r.role_code INTO v_role_code
  FROM users_login u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
  
  RETURN v_role_code IN ('SUPER_ADMIN', 'SUB_ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(role_codes character varying[])
RETURNS BOOLEAN AS $$
DECLARE
  v_role_code character varying;
BEGIN
  SELECT r.role_code INTO v_role_code
  FROM users_login u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
  
  RETURN v_role_code = ANY(role_codes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to workshop
CREATE OR REPLACE FUNCTION belongs_to_workshop(p_workshop_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
  v_workshop_id uuid;
BEGIN
  SELECT workshop_id INTO v_workshop_id
  FROM users_login
  WHERE id = auth.uid();
  
  RETURN v_workshop_id = p_workshop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's workshop ID
CREATE OR REPLACE FUNCTION get_user_workshop_id()
RETURNS uuid AS $$
DECLARE
  v_workshop_id uuid;
BEGIN
  SELECT workshop_id INTO v_workshop_id
  FROM users_login
  WHERE id = auth.uid();
  
  RETURN v_workshop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update service lead status timestamp
CREATE OR REPLACE FUNCTION update_service_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assigned_at when status changes to ASSIGNED
  IF NEW.status = 'ASSIGNED' AND OLD.status != 'ASSIGNED' THEN
    NEW.assigned_at = NOW();
  END IF;
  
  -- Update accepted_at when status changes to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    NEW.accepted_at = NOW();
  END IF;
  
  -- Update declined_at when status changes to REJECTED
  IF NEW.status = 'REJECTED' AND OLD.status != 'REJECTED' THEN
    NEW.declined_at = NOW();
  END IF;
  
  -- Update completed_at when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    NEW.completed_at = NOW();
  END IF;
  
  -- Update cancelled_at when status changes to CANCELLED
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    NEW.cancelled_at = NOW();
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update pickup task status timestamp
CREATE OR REPLACE FUNCTION update_pickup_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update started_at when status changes to IN_TRANSIT
  IF NEW.status = 'IN_TRANSIT' AND (OLD.status IS NULL OR OLD.status != 'IN_TRANSIT') THEN
    NEW.started_at = NOW();
  END IF;
  
  -- Update completed_at when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    NEW.completed_at = NOW();
  END IF;
  
  -- Update cancelled_at when status changes to CANCELLED
  IF NEW.status = 'CANCELLED' AND (OLD.status IS NULL OR OLD.status != 'CANCELLED') THEN
    NEW.cancelled_at = NOW();
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle GDPR data deletion
CREATE OR REPLACE FUNCTION process_data_deletion(p_request_id uuid, p_processed_by uuid)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id uuid;
  v_email character varying;
BEGIN
  -- Get user details from request
  SELECT user_id, email INTO v_user_id, v_email
  FROM data_deletion_requests
  WHERE id = p_request_id AND status = 'APPROVED';
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Anonymize user data
  UPDATE users_login
  SET 
    email = 'deleted_' || v_user_id || '@deleted.local',
    phone = NULL,
    full_name = 'Deleted User',
    is_active = FALSE,
    profile_image = NULL
  WHERE id = v_user_id;
  
  -- Delete user consents
  DELETE FROM user_consents WHERE user_id = v_user_id;
  
  -- Anonymize audit logs (keep for compliance but remove PII)
  UPDATE audit_logs
  SET 
    ip_address = NULL,
    user_agent = NULL
  WHERE user_id = v_user_id;
  
  -- Update deletion request status
  UPDATE data_deletion_requests
  SET 
    status = 'COMPLETED',
    processed_at = NOW(),
    processed_by = p_processed_by
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON FUNCTION generate_lead_number() IS 'Auto-generates lead numbers based on lead type (LN, RSA, HS)';
COMMENT ON FUNCTION generate_pickup_task_number() IS 'Auto-generates task numbers for pickup/delivery tasks';
COMMENT ON FUNCTION log_audit_event IS 'Logs audit events for GDPR compliance';
COMMENT ON FUNCTION is_admin() IS 'Checks if current user is admin (SUPER_ADMIN or SUB_ADMIN)';
COMMENT ON FUNCTION has_role IS 'Checks if current user has one of the specified roles';
COMMENT ON FUNCTION process_data_deletion IS 'Processes GDPR data deletion requests';

