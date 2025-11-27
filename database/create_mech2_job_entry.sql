-- Create mechanic_jobs entry for mech 2's assignment

-- Lead: L-44121613 (rahul)
-- Mechanic: mech 2 (5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1)

INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority,
  assigned_at,
  created_at,
  updated_at
)
VALUES (
  'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a',  -- lead_id (L-44121613)
  '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1',  -- mechanic_id (mech 2)
  (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a'),
  'ASSIGNED'::mechanic_job_status,
  'NORMAL'::job_priority,
  '2025-11-26 21:42:37.593+00',
  NOW(),
  NOW()
)
ON CONFLICT (lead_id) DO UPDATE SET
  mechanic_id = EXCLUDED.mechanic_id,
  assigned_by = EXCLUDED.assigned_by,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

-- Verify the entry was created
SELECT 
  'Verification' as test_type,
  mj.id,
  mj.lead_id,
  sl.lead_number,
  mj.mechanic_id,
  ul.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at
FROM mechanic_jobs mj
LEFT JOIN service_leads sl ON sl.id = mj.lead_id
LEFT JOIN users_login ul ON ul.id = mj.mechanic_id
WHERE mj.lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- Count mech 2's total jobs now
SELECT 
  'Mech 2 Total Jobs' as test_type,
  COUNT(*) as job_count
FROM mechanic_jobs
WHERE mechanic_id = '5e04d8b4-2d22-4cda-b31f-4cd19d5c80d1';

