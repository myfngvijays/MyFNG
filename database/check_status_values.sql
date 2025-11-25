-- Check actual status values in service_leads table
SELECT 
  status,
  COUNT(*) as count
FROM service_leads
WHERE workshop_id = (
  SELECT workshop_id 
  FROM users_login 
  WHERE email = 'your_supervisor_email@example.com'
)
GROUP BY status
ORDER BY status;

-- Check all jobs for supervisor's workshop
SELECT 
  id,
  lead_number,
  status,
  customer_name,
  vehicle_number,
  assigned_mechanic_id,
  workshop_id
FROM service_leads
WHERE workshop_id = (
  SELECT workshop_id 
  FROM users_login 
  WHERE email = 'your_supervisor_email@example.com'
)
ORDER BY created_at DESC
LIMIT 10;


