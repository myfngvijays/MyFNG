-- Test Mechanic Reassignment Logic

-- Scenario: Workshop admin changes mechanic from myfng10 to mech 2 for same lead

-- Test 1: Check current assignment for a lead
-- Replace with actual lead_id you want to reassign
SELECT 
  'Current Assignment' as test_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  ul.full_name as current_mechanic,
  mj.id as mechanic_job_id,
  mj.mechanic_id as job_mechanic_id,
  mj.mechanic_status,
  mj.assigned_at
FROM service_leads sl
LEFT JOIN users_login ul ON ul.id = sl.assigned_mechanic_id
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.lead_number = 'L-44121613';  -- Replace with actual lead number

-- Test 2: Simulate reassignment - what should happen:
-- Old mechanic: myfng10 (7fa49f5a-08e3-428e-8e6a-f4794e827302)
-- New mechanic: mech 2 (5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1)

-- Expected behavior:
-- 1. service_leads.assigned_mechanic_id should UPDATE to new mechanic
-- 2. mechanic_jobs.mechanic_id should UPDATE to new mechanic (NOT insert new record)
-- 3. Old mechanic should NOT see this job anymore
-- 4. New mechanic should see this job

-- Test 3: Check if UNIQUE constraint on lead_id prevents duplicate entries
SELECT 
  'Duplicate Check' as test_type,
  lead_id,
  COUNT(*) as entry_count
FROM mechanic_jobs
GROUP BY lead_id
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicates)

