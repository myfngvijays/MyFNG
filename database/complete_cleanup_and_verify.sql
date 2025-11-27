-- Complete cleanup and verification

-- ============================================
-- Step 1: Drop ALL policies completely
-- ============================================
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('job_cards', 'job_card_parts')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped policy: % on table: %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- ============================================
-- Step 2: Disable RLS
-- ============================================
ALTER TABLE public.job_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Verification - should show 0 policies
-- ============================================
SELECT 
  'Policies Check' as check_type,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('job_cards', 'job_card_parts');

-- ============================================
-- Step 4: Verification - RLS should be false
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
-- Step 5: Test direct query
-- ============================================
SELECT 
  'Direct Query Test' as check_type,
  COUNT(*) as job_cards_count
FROM public.job_cards;

-- ============================================
-- Step 6: Check table permissions
-- ============================================
SELECT 
  'Table Permissions' as check_type,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('job_cards', 'job_card_parts')
AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;

