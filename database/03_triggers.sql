-- ============================================
-- MyFNG Database Triggers
-- All database triggers
-- ============================================

-- Trigger: Auto-generate lead number
CREATE TRIGGER trigger_generate_lead_number
  BEFORE INSERT ON service_leads
  FOR EACH ROW
  EXECUTE FUNCTION generate_lead_number();

-- Trigger: Auto-generate pickup task number
CREATE TRIGGER trigger_generate_pickup_task_number
  BEFORE INSERT ON pickup_delivery_tasks
  FOR EACH ROW
  EXECUTE FUNCTION generate_pickup_task_number();

-- Trigger: Update updated_at on roles
CREATE TRIGGER trigger_update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on users_login
CREATE TRIGGER trigger_update_users_login_updated_at
  BEFORE UPDATE ON users_login
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on workshops
CREATE TRIGGER trigger_update_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update service_leads with status timestamps
CREATE TRIGGER trigger_update_service_leads_status
  BEFORE UPDATE ON service_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_service_leads_updated_at();

-- Trigger: Update pickup_tasks with status timestamps
CREATE TRIGGER trigger_update_pickup_tasks_status
  BEFORE UPDATE ON pickup_delivery_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_pickup_tasks_updated_at();

-- Trigger: Log lead activity on status change
CREATE TRIGGER trigger_log_lead_activity
  AFTER UPDATE ON service_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_activity();

-- Trigger: Update user_consents updated_at
CREATE TRIGGER trigger_update_user_consents_updated_at
  BEFORE UPDATE ON user_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TRIGGER trigger_generate_lead_number ON service_leads IS 'Auto-generates unique lead numbers';
COMMENT ON TRIGGER trigger_log_lead_activity ON service_leads IS 'Logs all status changes for audit trail';

