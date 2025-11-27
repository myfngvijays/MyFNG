-- Check if the latest assignment (mech 2) was created correctly

-- Test 1: Check latest mechanic_jobs entry
SELECT 
  'Latest Mechanic Jobs' as test_type,
  mj.id,
  mj.lead_id,
  sl.lead_number,
  mj.mechanic_id,
  ul.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at,
  mj.created_at
FROM mechanic_jobs mj
LEFT JOIN service_leads sl ON sl.id = mj.lead_id
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
ORDER BY mj.created_at DESC
LIMIT 5;

-- Test 2: Check lead L-44121613 specifically
SELECT 
  'Lead L-44121613 Status' as test_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  ul_mech.full_name as mechanic_name,
  sl.status as lead_status,
  mj.id as mechanic_job_id,
  mj.mechanic_status
FROM service_leads sl
LEFT JOIN users_login ul_mech ON ul_mech.id = sl.assigned_mechanic_id
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.lead_number = 'L-44121613';

-- Test 3: Check mech 2 user ID
SELECT 
  'Mech 2 User Details' as test_type,
  ul.id as user_id,
  ul.full_name,
  ul.email,
  ul.workshop_id,
  r.role_code
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE ul.full_name ILIKE '%mech 2%'
OR ul.full_name ILIKE '%mech2%';

-- Test 4: Count jobs for mech 2 (using actual ID if found above)
SELECT 
  'Mech 2 Job Count' as test_type,
  mechanic_id,
  ul.full_name as mechanic_name,
  COUNT(*) as job_count
FROM mechanic_jobs mj
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
WHERE ul.full_name ILIKE '%mech 2%'
OR ul.full_name ILIKE '%mech2%'
GROUP BY mechanic_id, ul.full_name;

-- Test 5: Get mech 2's specific user ID
SELECT 
  'Get Mech 2 ID' as test_type,
  ul.id
FROM users_login ul
WHERE ul.full_name ILIKE '%mech 2%'
OR ul.full_name ILIKE '%mech2%';

