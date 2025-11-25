-- Check what's in service_type_ids for this lead
SELECT 
  lead_number,
  service_type,
  service_type_ids,
  problem_description
FROM service_leads
WHERE lead_number = 'L-55270548';

-- Also check if service_types table has data
SELECT * FROM service_types LIMIT 10;

