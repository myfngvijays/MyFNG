-- Link all 6 workshop staff to the test workshop (fixes "No pickup boys in this workshop").
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54

UPDATE users_login
SET workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54',
    is_active = true,
    updated_at = now()
WHERE lower(email) IN (
  'vijayshinde121@gmail.com',
  'projectsinindia2@gmail.com',
  'roadservedigital@gmail.com',
  'myfng10@gmail.com',
  'pronewsinfodata@gmail.com',
  'aman.g@roadserve.in'
);

SELECT r.role_name, ul.full_name, ul.email, ul.workshop_id, ul.is_active
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
ORDER BY r.role_name, ul.full_name;
