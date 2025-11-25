-- Check if supervisor_notes or similar column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name LIKE '%note%'
OR column_name LIKE '%supervisor%'
ORDER BY column_name;
