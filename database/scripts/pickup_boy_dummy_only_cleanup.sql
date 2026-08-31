-- Pickup boy should only see dummy leads Rahul + Arjun (active pickup).
-- Run ALL of this in Supabase SQL editor. Safe to re-run.
--
-- Pickup boy: pronewsinfodata@gmail.com
-- Dummy: L-DUM9690541 (Rahul), L-DUM9690542 (Priya), L-DUM9690543 (Arjun)

-- Optional: see current assignments first
SELECT sl.lead_number, sl.customer_name, sl.status, sl.pickup_status
FROM service_leads sl
JOIN users_login ul ON ul.id = sl.assigned_pickup_boy_id
WHERE lower(ul.email) = lower('pronewsinfodata@gmail.com')
ORDER BY sl.updated_at DESC;

BEGIN;

-- 1) Remove pickup boy from ALL leads
UPDATE service_leads
SET assigned_pickup_boy_id = NULL, updated_at = now()
WHERE assigned_pickup_boy_id = (
  SELECT id FROM users_login
  WHERE lower(email) = lower('pronewsinfodata@gmail.com')
  LIMIT 1
);

-- 2) Clear pickup_tracking for non-dummy leads
UPDATE pickup_tracking pt
SET pickup_assigned_to = NULL, updated_at = now()
FROM service_leads sl
WHERE pt.lead_id = sl.id
  AND pt.pickup_assigned_to = (
    SELECT id FROM users_login
    WHERE lower(email) = lower('pronewsinfodata@gmail.com')
    LIMIT 1
  )
  AND sl.lead_number NOT IN ('L-DUM9690541', 'L-DUM9690542', 'L-DUM9690543');

-- 3) Assign only Rahul + Arjun
UPDATE service_leads
SET
  assigned_pickup_boy_id = (
    SELECT id FROM users_login
    WHERE lower(email) = lower('pronewsinfodata@gmail.com')
    LIMIT 1
  ),
  pickup_status = 'ASSIGNED',
  updated_at = now()
WHERE lead_number IN ('L-DUM9690541', 'L-DUM9690543')
  AND deleted_at IS NULL;

-- 4) Priya: pickup done — stay unassigned
UPDATE service_leads
SET assigned_pickup_boy_id = NULL, updated_at = now()
WHERE lead_number = 'L-DUM9690542';

-- 5) Sync pickup_tracking for Rahul + Arjun
-- Note: pickup_tracking.pickup_status is an ENUM — use PENDING (not ASSIGNED).
-- service_leads.pickup_status is VARCHAR — ASSIGNED is fine there (step 3).
INSERT INTO pickup_tracking (lead_id, pickup_assigned_to, pickup_status, updated_at)
SELECT
  sl.id,
  (
    SELECT id FROM users_login
    WHERE lower(email) = lower('pronewsinfodata@gmail.com')
    LIMIT 1
  ),
  'PENDING'::pickup_status,
  now()
FROM service_leads sl
WHERE sl.lead_number IN ('L-DUM9690541', 'L-DUM9690543')
  AND sl.deleted_at IS NULL
ON CONFLICT (lead_id) DO UPDATE SET
  pickup_assigned_to = EXCLUDED.pickup_assigned_to,
  pickup_status = EXCLUDED.pickup_status,
  updated_at = now();

COMMIT;

-- 6) Verify (should show only Rahul + Arjun assigned to pickup boy)
SELECT
  sl.lead_number,
  sl.customer_name,
  sl.status,
  sl.pickup_status,
  ul.email AS pickup_boy_email
FROM service_leads sl
LEFT JOIN users_login ul ON ul.id = sl.assigned_pickup_boy_id
WHERE sl.assigned_pickup_boy_id IS NOT NULL
   OR sl.lead_number IN ('L-DUM9690541', 'L-DUM9690542', 'L-DUM9690543')
ORDER BY sl.lead_number;
