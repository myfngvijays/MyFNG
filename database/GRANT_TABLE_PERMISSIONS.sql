-- Test if tables are actually accessible via API
-- Run this to verify table permissions

-- Check table permissions
SELECT 
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name IN (
  'service_checklists',
  'mechanic_performance_metrics',
  'mechanic_extra_work_requests',
  'mechanic_media',
  'mechanic_parts_usage'
)
ORDER BY table_name, grantee;

-- Make sure 'anon' and 'authenticated' roles have access
GRANT ALL ON service_checklists TO anon, authenticated;
GRANT ALL ON mechanic_performance_metrics TO anon, authenticated;
GRANT ALL ON mechanic_extra_work_requests TO anon, authenticated;
GRANT ALL ON mechanic_media TO anon, authenticated;
GRANT ALL ON mechanic_parts_usage TO anon, authenticated;

-- Also grant usage on sequences if any
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verify RLS is still disabled
SELECT 
  schemaname,
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

-- Success
DO $$
BEGIN
  RAISE NOTICE '✅ Permissions granted to anon and authenticated roles!';
END $$;

