-- First, let's check what columns exist in service_types table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_types' 
ORDER BY ordinal_position;

-- Also check subservices table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subservices' 
ORDER BY ordinal_position;

