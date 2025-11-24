-- ============================================
-- FIX: Sync existing mechanic assignments to mechanic_jobs table
-- ============================================
-- This script creates mechanic_jobs entries for leads that have 
-- assigned_mechanic_id but no corresponding mechanic_jobs entry

-- Insert missing mechanic_jobs from service_leads
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
  'ASSIGNED' as mechanic_status,
  COALESCE(sl.lead_priority, 'NORMAL') as job_priority,
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
  -- Only for active/in-progress leads
  AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
  -- Not completed/cancelled
  AND sl.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED');

-- Show how many records were inserted
SELECT 
  COUNT(*) as records_created,
  'mechanic_jobs entries created for existing assignments' as message
FROM mechanic_jobs mj
WHERE mj.created_at >= NOW() - INTERVAL '1 minute';

-- Verify the sync
SELECT 
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  mj.id as mechanic_job_id,
  mj.mechanic_status,
  CASE 
    WHEN mj.id IS NULL THEN '❌ Missing'
    ELSE '✅ Synced'
  END as sync_status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON sl.id = mj.lead_id
WHERE sl.assigned_mechanic_id IS NOT NULL
  AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
ORDER BY sl.updated_at DESC
LIMIT 20;

-- Specifically check the two leads mentioned
SELECT 
  'Lead Check' as check_type,
  sl.lead_number,
  sl.customer_name,
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

-- ============================================
-- NOTES:
-- ============================================
-- This script safely syncs existing mechanic assignments to mechanic_jobs table
-- - Only creates entries for leads with assigned mechanics
-- - Skips if mechanic_jobs entry already exists
-- - Only processes active/in-progress leads
-- - Preserves assignment timestamps and notes
--
-- After running this:
-- 1. Mechanic dashboard will show these jobs
-- 2. mechanic_dashboard view will include them
-- 3. Future assignments will auto-create mechanic_jobs (API fixed)
-- ============================================

