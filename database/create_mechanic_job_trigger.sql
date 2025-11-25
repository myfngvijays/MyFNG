-- Drop existing trigger if any
DROP TRIGGER IF EXISTS create_mechanic_job_on_assignment ON service_leads;
DROP FUNCTION IF EXISTS create_mechanic_job_entry();

-- Function to create mechanic_jobs entry when mechanic is assigned
CREATE OR REPLACE FUNCTION create_mechanic_job_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if mechanic was just assigned (not null and changed)
  IF NEW.assigned_mechanic_id IS NOT NULL AND 
     (OLD.assigned_mechanic_id IS NULL OR OLD.assigned_mechanic_id != NEW.assigned_mechanic_id) THEN
    
    -- Check if mechanic_jobs entry already exists
    IF NOT EXISTS (SELECT 1 FROM mechanic_jobs WHERE lead_id = NEW.id) THEN
      -- Create mechanic_jobs entry
      INSERT INTO mechanic_jobs (
        lead_id,
        mechanic_id,
        assigned_by,
        job_priority,
        mechanic_status,
        assigned_at,
        min_before_images,
        min_progress_images,
        min_after_images
      ) VALUES (
        NEW.id,
        NEW.assigned_mechanic_id,
        COALESCE(NEW.assigned_by_workshop_admin_id, NEW.assigned_by),
        COALESCE(NEW.priority, 'NORMAL'),
        'ASSIGNED',
        NOW(),
        3,  -- minimum 3 before images
        2,  -- minimum 2 progress images
        3   -- minimum 3 after images
      );
      
      RAISE NOTICE 'Created mechanic_jobs entry for lead_id: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER create_mechanic_job_on_assignment
  AFTER INSERT OR UPDATE OF assigned_mechanic_id
  ON service_leads
  FOR EACH ROW
  EXECUTE FUNCTION create_mechanic_job_entry();

COMMENT ON TRIGGER create_mechanic_job_on_assignment ON service_leads IS 
  'Automatically creates mechanic_jobs entry when a mechanic is assigned to a lead';

-- Now create entry for the existing lead
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  job_priority,
  mechanic_status,
  assigned_at,
  min_before_images,
  min_progress_images,
  min_after_images
)
SELECT 
  sl.id,
  sl.assigned_mechanic_id,
  COALESCE(sl.assigned_by_workshop_admin_id, sl.assigned_by),
  COALESCE(sl.priority, 'NORMAL'),
  'ASSIGNED',
  NOW(),
  3,
  2,
  3
FROM service_leads sl
WHERE sl.lead_number = 'L-55270548'
  AND sl.assigned_mechanic_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mechanic_jobs WHERE lead_id = sl.id)
ON CONFLICT (lead_id) DO NOTHING;

SELECT 'Trigger created and mechanic_jobs entry added!' as status;
