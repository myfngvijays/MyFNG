-- Check if this specific lead has a mechanic_jobs entry
SELECT 
  'Checking lead_id from URL' as check_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.assigned_mechanic_id,
  mj.id as mechanic_job_id,
  mj.mechanic_status,
  CASE 
    WHEN mj.id IS NULL THEN '❌ No mechanic_jobs entry found'
    ELSE '✅ Entry exists'
  END as status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON sl.id = mj.lead_id
WHERE sl.id = '94b886e6-7054-4885-b163-cb3275c2f627';

-- If no entry found, create it
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority,
  assigned_at,
  work_notes
)
SELECT 
  sl.id as lead_id,
  sl.assigned_mechanic_id as mechanic_id,
  COALESCE(sl.assigned_by_workshop_admin_id, sl.created_by_id) as assigned_by,
  'ASSIGNED'::mechanic_job_status as mechanic_status,
  COALESCE(sl.lead_priority::text, 'NORMAL')::job_priority as job_priority,
  COALESCE(sl.mechanic_assigned_at, sl.updated_at) as assigned_at,
  sl.internal_notes as work_notes
FROM service_leads sl
WHERE sl.id = '94b886e6-7054-4885-b163-cb3275c2f627'
  AND sl.assigned_mechanic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mechanic_jobs mj WHERE mj.lead_id = sl.id
  )
ON CONFLICT (lead_id) DO NOTHING;

-- Verify it was created
SELECT 
  'After insert' as check_type,
  mj.id as mechanic_job_id,
  sl.lead_number,
  sl.customer_name,
  mj.mechanic_status,
  mj.assigned_at
FROM mechanic_jobs mj
JOIN service_leads sl ON mj.lead_id = sl.id
WHERE mj.lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

