-- Alternative: Fix specific broken assignments one by one
-- Use this if you want more control over which assignments to fix

-- Fix for Lead: L-73790710 (vijay)
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
  '1e068a86-e7c5-4fbc-9d75-4820d17fa36b',  -- lead_id
  '7fa49f5a-08e3-428e-8e6a-f4794e827302',  -- mechanic_id
  (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = '1e068a86-e7c5-4fbc-9d75-4820d17fa36b'),
  'ASSIGNED'::mechanic_job_status,
  'NORMAL'::job_priority,
  '2025-11-26 06:59:24.228+00',
  NOW(),
  NOW()
)
ON CONFLICT (lead_id) DO UPDATE SET
  mechanic_id = EXCLUDED.mechanic_id,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

-- Fix for Lead: L-55270548 (Vijay)
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
  'a0d1934a-324c-409b-a27b-6ad385386420',  -- lead_id
  '7fa49f5a-08e3-428e-8e6a-f4794e827302',  -- mechanic_id
  (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = 'a0d1934a-324c-409b-a27b-6ad385386420'),
  'ASSIGNED'::mechanic_job_status,
  'NORMAL'::job_priority,
  '2025-11-25 12:09:14.387+00',
  NOW(),
  NOW()
)
ON CONFLICT (lead_id) DO UPDATE SET
  mechanic_id = EXCLUDED.mechanic_id,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

-- Fix for Lead: L-44036378 (niti)
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
  'ba147bf2-83a3-435a-b0c9-c12a15d271cd',  -- lead_id
  '7fa49f5a-08e3-428e-8e6a-f4794e827302',  -- mechanic_id
  (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = 'ba147bf2-83a3-435a-b0c9-c12a15d271cd'),
  'ASSIGNED'::mechanic_job_status,
  'NORMAL'::job_priority,
  '2025-11-26 08:17:58.924+00',
  NOW(),
  NOW()
)
ON CONFLICT (lead_id) DO UPDATE SET
  mechanic_id = EXCLUDED.mechanic_id,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

-- Fix for Lead: L-44121613 (rahul)
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
  'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a',  -- lead_id
  '7fa49f5a-08e3-428e-8e6a-f4794e827302',  -- mechanic_id
  (SELECT assigned_by_workshop_admin_id FROM service_leads WHERE id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a'),
  'ASSIGNED'::mechanic_job_status,
  'NORMAL'::job_priority,
  '2025-11-26 21:26:44.995+00',
  NOW(),
  NOW()
)
ON CONFLICT (lead_id) DO UPDATE SET
  mechanic_id = EXCLUDED.mechanic_id,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = NOW();

-- Verify all 4 leads now have mechanic_jobs entries
SELECT 
  'Verification' as status,
  sl.lead_number,
  sl.customer_name,
  mj.id as mechanic_job_id,
  mj.mechanic_status,
  mj.assigned_at
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.id IN (
  '1e068a86-e7c5-4fbc-9d75-4820d17fa36b',
  'a0d1934a-324c-409b-a27b-6ad385386420',
  'ba147bf2-83a3-435a-b0c9-c12a15d271cd',
  'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a'
);

