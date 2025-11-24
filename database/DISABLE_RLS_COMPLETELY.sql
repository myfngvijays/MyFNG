-- Simple solution: Just disable RLS completely for these tables
-- This is for development/testing - we can add proper RLS later

ALTER TABLE IF EXISTS mechanic_performance_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mechanic_extra_work_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mechanic_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mechanic_parts_usage DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'mechanic_performance_metrics',
  'service_checklists',
  'mechanic_extra_work_requests',
  'mechanic_media',
  'mechanic_parts_usage'
)
ORDER BY tablename;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS completely disabled for mechanic tables. 406 errors should be fixed now!';
END $$;

