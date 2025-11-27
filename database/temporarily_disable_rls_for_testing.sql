-- TEMPORARY: Disable RLS for testing
-- Use this ONLY to verify if RLS is the issue
-- WARNING: This makes tables accessible to everyone - use only for testing!

-- ============================================
-- Disable RLS temporarily
-- ============================================
ALTER TABLE public.job_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Verification
-- ============================================
SELECT 
  'RLS Status After Disable' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('job_cards', 'job_card_parts');

-- ============================================
-- IMPORTANT: After testing, re-enable RLS:
-- ============================================
-- ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;
-- Then run fix_job_cards_rls_with_session_check.sql again

