-- Check if mechanic assignment is working correctly

-- Test 1: Check if mechanic_jobs records exist
SELECT 
  'Mechanic Jobs Check' as test_type,
  mj.id,
  mj.lead_id,
  mj.mechanic_id,
  mj.mechanic_status,
  mj.assigned_at,
  sl.lead_number,
  sl.customer_name,
  sl.status as lead_status,
  ul.full_name as mechanic_name
FROM mechanic_jobs mj
LEFT JOIN service_leads sl ON sl.id = mj.lead_id
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
ORDER BY mj.assigned_at DESC
LIMIT 10;

-- Test 2: Check if assigned_mechanic_id is set in service_leads
SELECT 
  'Leads with Mechanic' as test_type,
  id,
  lead_number,
  customer_name,
  assigned_mechanic_id,
  mechanic_assigned_at,
  status
FROM service_leads
WHERE assigned_mechanic_id IS NOT NULL
ORDER BY mechanic_assigned_at DESC
LIMIT 10;

-- Test 3: Check specific lead assignment status
-- Replace with actual lead_id
SELECT 
  'Specific Lead Check' as test_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.assigned_mechanic_id,
  sl.status,
  mj.id as mechanic_job_id,
  mj.mechanic_status,
  mj.assigned_at as job_assigned_at
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';  -- Replace with actual lead ID

-- Test 4: Find leads with mechanic assigned but NO mechanic_jobs entry (broken assignments)
SELECT 
  'Broken Assignments' as test_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  sl.mechanic_assigned_at
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.assigned_mechanic_id IS NOT NULL
AND mj.id IS NULL
LIMIT 10;

