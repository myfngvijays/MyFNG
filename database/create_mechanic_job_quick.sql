-- Fix: Use correct column name
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
  COALESCE(assigned_by_workshop_admin_id, assigned_supervisor_id) as assigned_by,
  'ASSIGNED' as mechanic_status,
  'NORMAL' as job_priority
FROM service_leads 
WHERE id = '94b886e6-7054-4885-b163-cb3275c2f627'
  AND assigned_mechanic_id IS NOT NULL
ON CONFLICT (lead_id) DO NOTHING;

-- Verify it was created
SELECT * FROM mechanic_jobs 
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

