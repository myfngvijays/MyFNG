-- Check existing RLS policies on mechanic_jobs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'mechanic_jobs'
ORDER BY policyname;

