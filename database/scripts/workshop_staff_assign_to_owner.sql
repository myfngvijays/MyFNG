-- Assign all workshop staff to ONE owner / workshop.
-- Owner: vijayshinde121@gmail.com (Vijay Shinde)
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54
--
-- Staff (6 total):
--   Owner:   vijayshinde121@gmail.com
--   Advisor: projectsindia2@gmail.com
--   Mechanic: roadservedigital@gmail.com, myfng10@gmail.com
--   Pickup:  pronewsinfodata@gmail.com, aman.g@roadserve.in

BEGIN;

-- 1) Preview before update
SELECT ul.email, ul.full_name, r.role_name, ul.workshop_id, ul.is_active
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE lower(ul.email) IN (
  'vijayshinde121@gmail.com',
  'projectsinindia2@gmail.com',
  'roadservedigital@gmail.com',
  'myfng10@gmail.com',
  'pronewsinfodata@gmail.com',
  'aman.g@roadserve.in'
)
ORDER BY r.role_name, ul.email;

-- 2) Bind everyone to owner's workshop + activate
UPDATE users_login ul
SET
  workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54',
  is_active = true,
  updated_at = now()
WHERE lower(ul.email) IN (
  'vijayshinde121@gmail.com',
  'projectsinindia2@gmail.com',
  'roadservedigital@gmail.com',
  'myfng10@gmail.com',
  'pronewsinfodata@gmail.com',
  'aman.g@roadserve.in'
);

-- 3) Optional: staff report to owner via manager_id
UPDATE users_login staff
SET
  manager_id = owner.id,
  updated_at = now()
FROM users_login owner
WHERE lower(owner.email) = 'vijayshinde121@gmail.com'
  AND staff.id <> owner.id
  AND lower(staff.email) IN (
    'projectsinindia2@gmail.com',
    'roadservedigital@gmail.com',
    'myfng10@gmail.com',
    'pronewsinfodata@gmail.com',
    'aman.g@roadserve.in'
  );

COMMIT;

-- 4) Verify — all 6 on same workshop
SELECT
  r.role_name,
  ul.full_name,
  ul.email,
  ul.workshop_id,
  w.name AS workshop_name,
  ul.is_active,
  mgr.email AS reports_to
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
LEFT JOIN workshops w ON w.id = ul.workshop_id
LEFT JOIN users_login mgr ON mgr.id = ul.manager_id
WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
  AND r.role_code IN (
    'WORKSHOP_ADMIN',
    'WORKSHOP_SUPERVISOR',
    'WORKSHOP_MECHANIC',
    'WORKSHOP_PICKUP_BOY'
  )
ORDER BY r.role_name, ul.full_name;
