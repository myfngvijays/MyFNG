-- Purge ALL leads for Express / test workshop (dummy + real).
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54
-- Clears service_leads + cascaded child rows (pickup_tracking, mechanic_jobs, etc.)

-- Preview
SELECT lead_number, customer_name, status, pickup_status, created_at
FROM service_leads
WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
ORDER BY created_at DESC;

SELECT count(*) AS leads_to_delete
FROM service_leads
WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54';

BEGIN;

-- Extra safety: orphan pickup rows for this workshop's leads
DELETE FROM pickup_tracking
WHERE lead_id IN (
  SELECT id FROM service_leads
  WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
);

DELETE FROM mechanic_jobs
WHERE lead_id IN (
  SELECT id FROM service_leads
  WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
);

DELETE FROM mechanic_assignments
WHERE lead_id IN (
  SELECT id FROM service_leads
  WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
);

-- Main delete (most child tables CASCADE from service_leads)
DELETE FROM service_leads
WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54';

COMMIT;

-- Verify — should be 0
SELECT count(*) AS remaining_leads
FROM service_leads
WHERE workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54';
