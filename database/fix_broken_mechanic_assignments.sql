-- Fix Broken Mechanic Assignments
-- This script creates missing mechanic_jobs entries for leads that have assigned_mechanic_id but no mechanic_jobs record

-- Step 1: Show broken assignments before fix
SELECT 
  'Broken Assignments BEFORE Fix' as status,
  COUNT(*) as count
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.assigned_mechanic_id IS NOT NULL
AND mj.id IS NULL;

-- Step 2: Create missing mechanic_jobs entries
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority,
  assigned_at,
  work_notes,
  created_at,
  updated_at
)
SELECT 
  sl.id as lead_id,
  sl.assigned_mechanic_id as mechanic_id,
  COALESCE(sl.assigned_by_workshop_admin_id, sl.assigned_mechanic_id) as assigned_by,  -- Fallback to mechanic if NULL
  'ASSIGNED'::mechanic_job_status as mechanic_status,
  COALESCE(sl.lead_priority, 'NORMAL')::job_priority as job_priority,
  COALESCE(sl.mechanic_assigned_at, sl.updated_at) as assigned_at,
  sl.internal_notes as work_notes,
  NOW() as created_at,
  NOW() as updated_at
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.assigned_mechanic_id IS NOT NULL
AND mj.id IS NULL;

-- Step 3: Verify fix - should show 0 broken assignments
SELECT 
  'Broken Assignments AFTER Fix' as status,
  COUNT(*) as count
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.assigned_mechanic_id IS NOT NULL
AND mj.id IS NULL;

-- Step 4: Show newly created mechanic_jobs
SELECT 
  'Newly Created Jobs' as status,
  mj.id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  ul.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at
FROM mechanic_jobs mj
JOIN service_leads sl ON sl.id = mj.lead_id
JOIN users_login ul ON ul.id = mj.mechanic_id
WHERE mj.created_at >= NOW() - INTERVAL '1 minute'
ORDER BY mj.created_at DESC;

