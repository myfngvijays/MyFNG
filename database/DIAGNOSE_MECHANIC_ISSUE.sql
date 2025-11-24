-- ============================================
-- DIAGNOSE: Why mechanic dashboard is empty
-- Run this to see what's missing
-- ============================================

-- Step 1: Check if mechanic_jobs table exists and has data
SELECT 
  'mechanic_jobs table check' as test,
  COUNT(*) as row_count
FROM mechanic_jobs;

-- Step 2: Check service_leads with assigned mechanics
SELECT 
  'service_leads with mechanics' as test,
  sl.lead_number,
  sl.customer_name,
  sl.vehicle_number,
  sl.status,
  sl.assigned_mechanic_id,
  ul.full_name as mechanic_name,
  sl.mechanic_assigned_at
FROM service_leads sl
LEFT JOIN users_login ul ON sl.assigned_mechanic_id = ul.id
WHERE sl.assigned_mechanic_id IS NOT NULL
  AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
ORDER BY sl.updated_at DESC
LIMIT 10;

-- Step 3: Check specifically for the two mentioned leads
SELECT 
  'Specific leads check' as test,
  sl.id,
  sl.lead_number,
  sl.customer_name,
  sl.vehicle_number,
  sl.status,
  sl.assigned_mechanic_id,
  ul.full_name as mechanic_name
FROM service_leads sl
LEFT JOIN users_login ul ON sl.assigned_mechanic_id = ul.id
WHERE sl.lead_number IN ('L-69057474', 'L-31838254');

-- Step 4: Check if mechanic_dashboard view exists
SELECT 
  'mechanic_dashboard view check' as test,
  COUNT(*) as row_count
FROM mechanic_dashboard;

-- Step 5: Get the mechanic's user ID
SELECT 
  'Mechanic user info' as test,
  id,
  full_name,
  email,
  role_id,
  workshop_id
FROM users_login
WHERE id = '7fa49f5a-08e3-428e-8e6a-f4794e827302';

-- ============================================
-- NEXT STEPS based on results:
-- ============================================
-- If mechanic_jobs is empty (row_count = 0):
--   Run: database/FIX_SYNC_MECHANIC_JOBS.sql
--
-- If service_leads shows the leads but mechanic_jobs is empty:
--   The INSERT statement in FIX_SYNC_MECHANIC_JOBS.sql will fix it
--
-- If mechanic_dashboard is empty even after mechanic_jobs has data:
--   The view might need to be recreated
-- ============================================

