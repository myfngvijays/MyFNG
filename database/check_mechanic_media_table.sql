-- Check if mechanic_media table exists and has all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'mechanic_media'
ORDER BY ordinal_position;

