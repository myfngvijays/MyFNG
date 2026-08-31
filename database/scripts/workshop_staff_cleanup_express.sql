-- Clean workshop staff — keep only active test users per role.
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54
-- Uses is_active = false (no deleted_at column required).
--
-- KEEP:
--   Pickup:   pronewsinfodata@gmail.com, aman.g@roadserve.in
--   Mechanic: roadservedigital@gmail.com, myfng10@gmail.com
--   Advisor:  projectsindia2@gmail.com
--   Owner:    vijayshinde121@gmail.com

BEGIN;

UPDATE service_leads sl
SET assigned_pickup_boy_id = NULL, updated_at = now()
WHERE assigned_pickup_boy_id IN (
  SELECT ul.id FROM users_login ul
  JOIN roles r ON r.id = ul.role_id
  WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
    AND lower(ul.email) NOT IN ('pronewsinfodata@gmail.com', 'aman.g@roadserve.in')
);

UPDATE service_leads sl
SET assigned_mechanic_id = NULL, updated_at = now()
WHERE assigned_mechanic_id IN (
  SELECT ul.id FROM users_login ul
  JOIN roles r ON r.id = ul.role_id
  WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
    AND r.role_code = 'WORKSHOP_MECHANIC'
    AND lower(ul.email) NOT IN ('roadservedigital@gmail.com', 'myfng10@gmail.com')
);

UPDATE service_leads sl
SET assigned_supervisor_id = NULL, updated_at = now()
WHERE assigned_supervisor_id IN (
  SELECT ul.id FROM users_login ul
  JOIN roles r ON r.id = ul.role_id
  WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
    AND lower(ul.email) NOT IN ('projectsinindia2@gmail.com')
);

UPDATE pickup_tracking pt
SET pickup_assigned_to = NULL, updated_at = now()
WHERE pickup_assigned_to IN (
  SELECT ul.id FROM users_login ul
  JOIN roles r ON r.id = ul.role_id
  WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
    AND lower(ul.email) NOT IN ('pronewsinfodata@gmail.com', 'aman.g@roadserve.in')
);

UPDATE users_login ul
SET is_active = false, updated_at = now()
FROM roles r
WHERE ul.role_id = r.id
  AND ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
  AND ul.is_active = true
  AND (
    (r.role_code = 'WORKSHOP_PICKUP_BOY' AND lower(ul.email) NOT IN ('pronewsinfodata@gmail.com', 'aman.g@roadserve.in'))
    OR (r.role_code = 'WORKSHOP_MECHANIC' AND lower(ul.email) NOT IN ('roadservedigital@gmail.com', 'myfng10@gmail.com'))
    OR (r.role_code = 'WORKSHOP_SUPERVISOR' AND lower(ul.email) NOT IN ('projectsinindia2@gmail.com'))
    OR (r.role_code = 'WORKSHOP_ADMIN' AND lower(ul.email) NOT IN ('vijayshinde121@gmail.com'))
  );

COMMIT;

SELECT r.role_name, ul.full_name, ul.email, ul.is_active
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
  AND ul.is_active = true
ORDER BY r.role_code, ul.full_name;
