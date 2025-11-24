-- Add function to calculate SLA remaining minutes for mechanic jobs
CREATE OR REPLACE FUNCTION calculate_mechanic_sla_remaining(
  p_expected_completion_time timestamp with time zone
)
RETURNS integer AS $$
BEGIN
  IF p_expected_completion_time IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(EPOCH FROM (p_expected_completion_time - NOW())) / 60;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the mechanic_dashboard view to calculate SLA dynamically
CREATE OR REPLACE VIEW mechanic_dashboard AS
SELECT 
  mj.id as job_id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.customer_phone,
  sl.vehicle_number,
  sl.vehicle_make,
  sl.vehicle_model,
  sl.vehicle_variant,
  sl.vehicle_fuel_type,
  sl.problem_description,
  sl.service_type_ids,
  sl.subservice_ids,
  mj.mechanic_status,
  mj.job_priority,
  mj.assigned_at,
  mj.started_at,
  mj.completed_at,
  mj.expected_completion_time,
  -- Calculate SLA remaining dynamically
  CASE 
    WHEN mj.expected_completion_time IS NOT NULL THEN
      FLOOR(EXTRACT(EPOCH FROM (mj.expected_completion_time - NOW())) / 60)::integer
    ELSE
      NULL
  END as sla_remaining_minutes,
  mj.work_notes,
  mj.mechanic_observations,
  mj.issues_found,
  mj.checklist_completed,
  mj.before_images_count,
  mj.progress_images_count,
  mj.after_images_count,
  mj.min_before_images,
  mj.min_progress_images,
  mj.min_after_images,
  mj.mechanic_id,
  sl.workshop_id,
  sl.pickup_required,
  sl.pickup_status,
  sl.status as lead_status,
  mj.created_at,
  mj.updated_at
FROM mechanic_jobs mj
JOIN service_leads sl ON mj.lead_id = sl.id
WHERE mj.mechanic_status NOT IN ('COMPLETED', 'READY_FOR_DELIVERY')
ORDER BY mj.assigned_at DESC;

-- Also update mechanic_jobs to set expected_completion_time when assigned
-- Trigger to set expected_completion_time (e.g., 4 hours from assignment)
CREATE OR REPLACE FUNCTION set_mechanic_expected_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If expected_completion_time is not set, calculate it based on priority
  IF NEW.expected_completion_time IS NULL AND NEW.assigned_at IS NOT NULL THEN
    CASE NEW.job_priority
      WHEN 'URGENT' THEN
        NEW.expected_completion_time := NEW.assigned_at + INTERVAL '2 hours';
      WHEN 'HIGH' THEN
        NEW.expected_completion_time := NEW.assigned_at + INTERVAL '4 hours';
      WHEN 'NORMAL' THEN
        NEW.expected_completion_time := NEW.assigned_at + INTERVAL '8 hours';
      ELSE
        NEW.expected_completion_time := NEW.assigned_at + INTERVAL '8 hours';
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_mechanic_expected_completion ON mechanic_jobs;
CREATE TRIGGER trigger_set_mechanic_expected_completion
  BEFORE INSERT OR UPDATE ON mechanic_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_mechanic_expected_completion();

-- Update existing records that don't have expected_completion_time
UPDATE mechanic_jobs
SET expected_completion_time = 
  CASE job_priority
    WHEN 'URGENT' THEN assigned_at + INTERVAL '2 hours'
    WHEN 'HIGH' THEN assigned_at + INTERVAL '4 hours'
    WHEN 'NORMAL' THEN assigned_at + INTERVAL '8 hours'
    ELSE assigned_at + INTERVAL '8 hours'
  END
WHERE expected_completion_time IS NULL AND assigned_at IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'SLA calculation added successfully! Expected completion times updated.';
END $$;

