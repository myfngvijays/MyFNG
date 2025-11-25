-- Check if mechanic_jobs entry exists for this lead
SELECT * FROM mechanic_jobs 
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

-- If not exists, let's check the service_leads table
SELECT 
  id as lead_id,
  lead_number,
  assigned_mechanic_id,
  status
FROM service_leads 
WHERE id = '94b886e6-7054-4885-b163-cb3275c2f627';

-- Create mechanic_jobs entry if it doesn't exist
-- (Replace the mechanic_id and assigned_by with actual values from above query)
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority
)
SELECT 
  id as lead_id,
  assigned_mechanic_id as mechanic_id,
  assigned_workshop_admin_id as assigned_by, -- or use a supervisor/admin ID
  'ASSIGNED' as mechanic_status,
  'NORMAL' as job_priority
FROM service_leads 
WHERE id = '94b886e6-7054-4885-b163-cb3275c2f627'
  AND assigned_mechanic_id IS NOT NULL
ON CONFLICT (lead_id) DO NOTHING;

-- Verify it was created
SELECT * FROM mechanic_jobs 
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

