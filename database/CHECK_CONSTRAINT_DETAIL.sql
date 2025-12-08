-- Detailed constraint check
-- Show EXACTLY what the constraint looks like

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS full_constraint_definition
FROM pg_constraint
WHERE conrelid = 'mechanic_job_photos'::regclass
  AND contype = 'c'  -- Check constraints only
ORDER BY conname;


