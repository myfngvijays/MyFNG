-- Debug Current User Context for RLS
-- Run this in Supabase SQL Editor to see why RLS is blocking

-- ============================================
-- 1. Check Current User
-- ============================================
SELECT 
  'Current User ID' as check_type,
  auth.uid()::text as result;

-- ============================================
-- 2. Check User Details
-- ============================================
SELECT 
  'User Details' as check_type,
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
-- 3. Check if RLS is Enabled
-- ============================================
SELECT 
  'RLS Status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('job_cards', 'job_card_parts');

-- ============================================
-- 4. Test Specific Lead Access
-- ============================================
-- Replace with your actual lead_id
DO $$
DECLARE
  test_lead_id uuid := 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';
  user_workshop_id uuid;
  lead_workshop_id uuid;
  is_mechanic boolean;
  user_role_code text;
BEGIN
  -- Get user's workshop_id
  SELECT ul.workshop_id INTO user_workshop_id
  FROM public.users_login ul
  WHERE ul.id = auth.uid();
  
  -- Get lead's workshop_id
  SELECT sl.workshop_id INTO lead_workshop_id
  FROM public.service_leads sl
  WHERE sl.id = test_lead_id;
  
  -- Check if user is mechanic for this lead
  SELECT EXISTS(
    SELECT 1 FROM public.mechanic_jobs mj
    WHERE mj.lead_id = test_lead_id
    AND mj.mechanic_id = auth.uid()
  ) INTO is_mechanic;
  
  -- Get user's role
  SELECT r.role_code INTO user_role_code
  FROM public.users_login ul
  JOIN public.roles r ON ul.role_id = r.id
  WHERE ul.id = auth.uid();
  
  -- Output results
  RAISE NOTICE 'User Workshop ID: %', user_workshop_id;
  RAISE NOTICE 'Lead Workshop ID: %', lead_workshop_id;
  RAISE NOTICE 'Workshop Match: %', (user_workshop_id = lead_workshop_id);
  RAISE NOTICE 'Is Mechanic: %', is_mechanic;
  RAISE NOTICE 'User Role: %', user_role_code;
  RAISE NOTICE 'Has Admin Role: %', (user_role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER', 'BILLING', 'ACCOUNTS_TEAM'));
END $$;

-- ============================================
-- 5. Check All Policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

