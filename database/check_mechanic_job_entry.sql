-- Check if mechanic_jobs entry exists for this lead
SELECT 
  sl.lead_number,
  sl.id as lead_id,
  sl.assigned_mechanic_id,
  sl.assigned_pickup_boy_id,
  mj.id as mechanic_job_id,
  mj.mechanic_status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON mj.lead_id = sl.id
WHERE sl.lead_number = 'L-55270548';
