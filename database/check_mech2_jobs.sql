-- Check mechanic_jobs for mech 2 specifically

-- Mech 2 ID: 5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1

-- Test 1: Count jobs for mech 2
SELECT 
  'Mech 2 Job Count' as test_type,
  COUNT(*) as total_jobs
FROM mechanic_jobs
WHERE mechanic_id = '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1';

-- Test 2: Show all jobs for mech 2
SELECT 
  'Mech 2 Jobs' as test_type,
  mj.id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  mj.mechanic_status,
  mj.assigned_at,
  mj.created_at
FROM mechanic_jobs mj
LEFT JOIN service_leads sl ON sl.id = mj.lead_id
WHERE mj.mechanic_id = '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1'
ORDER BY mj.created_at DESC;

-- Test 3: Check if lead L-44121613 has a mechanic_jobs entry
SELECT 
  'L-44121613 Mechanic Job' as test_type,
  mj.id as job_id,
  mj.mechanic_id,
  ul.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at
FROM mechanic_jobs mj
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
WHERE mj.lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- Test 4: Check service_leads assignment for L-44121613
SELECT 
  'L-44121613 Lead Assignment' as test_type,
  sl.id,
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  ul.full_name as mechanic_name,
  sl.status,
  sl.mechanic_assigned_at
FROM service_leads sl
LEFT JOIN users_login ul ON ul.id = sl.assigned_mechanic_id
WHERE sl.lead_number = 'L-44121613';

