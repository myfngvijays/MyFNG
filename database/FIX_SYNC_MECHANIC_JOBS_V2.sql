-- ============================================
-- FIX: Sync existing mechanic assignments to mechanic_jobs table (V2)
-- ============================================
-- This version works with ANY lead_status enum configuration
-- It checks the actual status column values, not enum names
-- ============================================

-- First, let's see what status values exist in your database
SELECT DISTINCT status, COUNT(*) as count
FROM service_leads
WHERE assigned_mechanic_id IS NOT NULL
GROUP BY status
ORDER BY count DESC;

-- Insert missing mechanic_jobs from service_leads
-- Using a flexible status check that works with any enum
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
WHERE 
  -- Has assigned mechanic
  sl.assigned_mechanic_id IS NOT NULL
  -- But no mechanic_jobs entry exists
  AND NOT EXISTS (
    SELECT 1 
    FROM mechanic_jobs mj 
    WHERE mj.lead_id = sl.id
  )
  -- Not completed/cancelled (using flexible string matching)
  AND sl.status::text NOT ILIKE '%COMPLETED%'
  AND sl.status::text NOT ILIKE '%CANCELLED%'
  AND sl.status::text NOT ILIKE '%REJECTED%'
  AND sl.status::text NOT ILIKE '%CLOSED%';

-- Show how many records were inserted
SELECT 
  COUNT(*) as records_created,
  'mechanic_jobs entries created for existing assignments' as message
FROM mechanic_jobs mj
WHERE mj.created_at >= NOW() - INTERVAL '1 minute';

-- Verify the sync - show all mechanics with their jobs
SELECT 
  sl.lead_number,
  sl.customer_name,
  sl.vehicle_number,
  sl.status::text as lead_status,
  ul.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at,
  CASE 
    WHEN mj.id IS NULL THEN '❌ Missing'
    ELSE '✅ Synced'
  END as sync_status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON sl.id = mj.lead_id
LEFT JOIN users_login ul ON sl.assigned_mechanic_id = ul.id
WHERE sl.assigned_mechanic_id IS NOT NULL
  AND sl.status::text NOT ILIKE '%COMPLETED%'
  AND sl.status::text NOT ILIKE '%CANCELLED%'
ORDER BY sl.updated_at DESC
LIMIT 20;

-- Specifically check the two leads you mentioned
SELECT 
  '🔍 Checking specific leads' as check_type,
  sl.id,
  sl.lead_number,
  sl.customer_name,
  sl.vehicle_number,
  sl.status::text as lead_status,
  sl.assigned_mechanic_id,
  mj.id as mechanic_job_id,
  mj.mechanic_status,
  ul.full_name as mechanic_name
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON sl.id = mj.lead_id
LEFT JOIN users_login ul ON sl.assigned_mechanic_id = ul.id
WHERE sl.id IN (
  '0aa93747-e720-4fad-b5f1-eb53bcead8e8',  -- L-69057474
  '94b886e6-7054-4885-b163-cb3275c2f627'   -- L-31838254
);

-- Final verification: Check mechanic_dashboard view
SELECT 
  '📊 Mechanic Dashboard Preview' as info,
  job_id,
  lead_number,
  customer_name,
  vehicle_number,
  mechanic_status,
  job_priority,
  assigned_at
FROM mechanic_dashboard
WHERE mechanic_id = '7fa49f5a-08e3-428e-8e6a-f4794e827302'
ORDER BY assigned_at DESC
LIMIT 10;

-- ============================================
-- NOTES:
-- ============================================
-- This version uses flexible string matching (::text and ILIKE)
-- instead of checking specific enum values, so it works regardless
-- of which enum values exist in your database.
--
-- After running this:
-- 1. Mechanic dashboard will show jobs
-- 2. Both mobile and web will work
-- 3. Future assignments will auto-create mechanic_jobs (API fixed)
-- ============================================

