-- Test RLS Authentication
-- Run this to check if user is authenticated

-- ============================================
-- Check 1: Is user authenticated?
-- ============================================
SELECT 
  'Auth Check' as test_name,
  auth.uid() as user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NOT AUTHENTICATED'
    ELSE '✅ AUTHENTICATED'
  END as auth_status;

-- ============================================
-- Check 2: Current user details
-- ============================================
SELECT 
  'User Details' as test_name,
  ul.id,
  ul.full_name,
  ul.email,
  ul.workshop_id,
  r.role_code,
  r.role_name
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid();

-- ============================================
-- Check 3: Test direct query (should work if authenticated)
-- ============================================
SELECT 
  'Direct Query Test' as test_name,
  COUNT(*) as job_cards_count
FROM public.job_cards;

-- ============================================
-- Check 4: Test with specific lead_id
-- ============================================
SELECT 
  'Lead Query Test' as test_name,
  COUNT(*) as job_cards_count
FROM public.job_cards
WHERE lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- Check 5: Check RLS status
-- ============================================
SELECT 
  'RLS Status' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('job_cards', 'job_card_parts');

