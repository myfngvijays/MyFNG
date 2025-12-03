-- =====================================================
-- FIX RLS POLICIES FOR SUPER ADMIN USER CREATION
-- Purpose: Allow Super Admins to create new users in users_login table
-- Date: 2025-12-03
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.users_login ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE HELPER FUNCTION TO CHECK SUPER ADMIN ROLE
-- This function avoids recursion by using SECURITY DEFINER
-- which bypasses RLS when checking the role
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role_code VARCHAR;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- If no user, return false
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check role_code directly from roles table via users_login
  -- SECURITY DEFINER allows this to bypass RLS, preventing recursion
  SELECT r.role_code INTO v_role_code
  FROM public.users_login ul
  JOIN public.roles r ON ul.role_id = r.id
  WHERE ul.id = v_user_id
  LIMIT 1;
  
  RETURN v_role_code = 'SUPER_ADMIN';
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, return false for safety
    RETURN FALSE;
END;
$$;

-- =====================================================
-- ADD POLICY FOR SUPER ADMIN TO INSERT USERS
-- =====================================================

-- Drop existing policy if it exists (to allow recreation)
DROP POLICY IF EXISTS "Super Admins can insert users" ON public.users_login;

-- Create policy for Super Admins to insert new users
CREATE POLICY "Super Admins can insert users"
ON public.users_login
FOR INSERT
WITH CHECK (
  -- Allow if the inserting user is a Super Admin
  public.is_super_admin() = TRUE
  OR
  -- Also allow if user is inserting their own profile (existing behavior)
  (auth.role() = 'authenticated' AND id = auth.uid())
);

-- =====================================================
-- ADD POLICY FOR SUPER ADMIN TO UPDATE USERS
-- =====================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Super Admins can update users" ON public.users_login;

-- Create policy for Super Admins to update any user
CREATE POLICY "Super Admins can update users"
ON public.users_login
FOR UPDATE
USING (
  -- Allow if the updating user is a Super Admin
  public.is_super_admin() = TRUE
  OR
  -- Also allow if user is updating their own profile (existing behavior)
  id = auth.uid()
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  public.is_super_admin() = TRUE
  OR
  id = auth.uid()
);

-- =====================================================
-- ADD POLICY FOR SUPER ADMIN TO VIEW ALL USERS
-- =====================================================

-- Note: The existing "Authenticated users can view users" policy already allows
-- all authenticated users to view users. But we can add a more explicit one
-- for Super Admins if needed. For now, the existing policy should be sufficient.

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users_login';
  
  RAISE NOTICE '✅ Super Admin user creation RLS policies fixed!';
  RAISE NOTICE '   Total policies on users_login: %', policy_count;
  RAISE NOTICE '   Super Admins can now insert and update users';
  RAISE NOTICE '   Helper function is_super_admin() created to avoid recursion';
END $$;

