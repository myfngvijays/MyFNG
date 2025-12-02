-- =====================================================
-- FIX INFINITE RECURSION IN users_login RLS POLICIES
-- Purpose: Remove any policies that cause infinite recursion
-- =====================================================

-- Drop problematic policies that reference users_login inside users_login policies
DROP POLICY IF EXISTS "Workshop admins can view their staff" ON public.users_login;
DROP POLICY IF EXISTS "Workshop admins can manage their staff" ON public.users_login;
DROP POLICY IF EXISTS "Workshop admins can add staff" ON public.users_login;

-- Ensure the safe policies from 26_fix_users_login_rls_recursion.sql are in place
-- These policies use auth.uid() and auth.role() directly without querying users_login

-- Policy 1: Users can view their own profile (safe - uses auth.uid() directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users_login' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.users_login
    FOR SELECT
    USING (id = auth.uid());
  END IF;
END $$;

-- Policy 2: Authenticated users can view users (safe - uses auth.role() directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users_login' 
    AND policyname = 'Authenticated users can view users'
  ) THEN
    CREATE POLICY "Authenticated users can view users"
    ON public.users_login
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Policy 3: Users can update their own profile (safe - uses auth.uid() directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users_login' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.users_login
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Policy 4: Allow user profile creation (safe - uses auth.role() and auth.uid() directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users_login' 
    AND policyname = 'Allow user profile creation'
  ) THEN
    CREATE POLICY "Allow user profile creation"
    ON public.users_login
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Removed problematic users_login policies that caused infinite recursion!';
    RAISE NOTICE '✅ Safe policies are now in place using auth.uid() and auth.role() directly!';
    RAISE NOTICE 'ℹ️  Workshop Admin staff management should be handled at API level after fetching user profile!';
END $$;

