-- Fix mismatch: Update mechanic_jobs to match service_leads assignment

-- Update mechanic_jobs.mechanic_id to mech 2 for lead L-44121613
UPDATE mechanic_jobs
SET 
  mechanic_id = '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1',  -- mech 2
  assigned_by = (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a'),
  assigned_at = '2025-11-26 21:42:37.593+00',
  updated_at = NOW()
WHERE lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- Verify the update
SELECT 
  'After Update' as test_type,
  sl.id as lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id as lead_mechanic_id,
  ul_lead.full_name as lead_mechanic_name,
  mj.mechanic_id as job_mechanic_id,
  ul_job.full_name as job_mechanic_name,
  CASE 
    WHEN sl.assigned_mechanic_id = mj.mechanic_id THEN '✅ MATCHED'
    ELSE '❌ MISMATCH'
  END as status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
LEFT JOIN users_login ul_lead ON ul_lead.id = sl.assigned_mechanic_id
LEFT JOIN users_login ul_job ON ul_job.id = mj.mechanic_id
WHERE sl.id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- Count mech 2's jobs
SELECT 
  'Mech 2 Job Count' as test_type,
  COUNT(*) as total_jobs
FROM mechanic_jobs
WHERE mechanic_id = '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1';

