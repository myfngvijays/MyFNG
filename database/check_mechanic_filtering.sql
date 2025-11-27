-- Check if mechanic_jobs query is filtering correctly

-- Test 1: Check all mechanic_jobs records
SELECT 
  'All Mechanic Jobs' as test_type,
  id,
  lead_id,
  mechanic_id,
  mechanic_status,
  assigned_at
FROM mechanic_jobs
ORDER BY assigned_at DESC;

-- Test 2: Count jobs per mechanic
SELECT 
  'Jobs Per Mechanic' as test_type,
  mechanic_id,
  ul.full_name as mechanic_name,
  COUNT(*) as job_count
FROM mechanic_jobs mj
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
GROUP BY mechanic_id, ul.full_name
ORDER BY job_count DESC;

-- Test 3: Check specific mechanic (replace with actual mechanic_id)
SELECT 
  'Specific Mechanic Jobs' as test_type,
  id,
  lead_id,
  mechanic_id,
  mechanic_status,
  assigned_at
FROM mechanic_jobs
WHERE mechanic_id = '7fa49f5a-08e3-428e-8e6a-f4794e827302'  -- Replace with actual mechanic ID
ORDER BY assigned_at DESC;

-- Test 4: Check if multiple mechanics in same workshop
SELECT 
  'Mechanics in Same Workshop' as test_type,
  ul.id as mechanic_id,
  ul.full_name as mechanic_name,
  ul.workshop_id,
  w.name as workshop_name,
  COUNT(mj.id) as assigned_jobs
FROM users_login ul
JOIN roles r ON ul.role_id = r.id
LEFT JOIN workshops w ON w.id = ul.workshop_id
LEFT JOIN mechanic_jobs mj ON mj.mechanic_id = ul.id
WHERE r.role_code = 'WORKSHOP_MECHANIC'
AND ul.is_active = true
GROUP BY ul.id, ul.full_name, ul.workshop_id, w.name
ORDER BY ul.workshop_id, ul.full_name;

