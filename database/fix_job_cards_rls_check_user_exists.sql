-- Fix RLS by checking if user exists in users_login table
-- This is more reliable than just checking auth.uid()

-- ============================================
-- Drop existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_authenticated_only" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_authenticated_only" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_allow_authenticated_users" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_allow_authenticated_users" ON public.job_card_parts;

-- ============================================
-- Ensure RLS is enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create policy that checks if user exists in users_login
-- This is more reliable than just auth.uid() IS NOT NULL
-- ============================================
CREATE POLICY "job_cards_user_exists"
ON public.job_cards
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.users_login ul
    WHERE ul.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.users_login ul
    WHERE ul.id = auth.uid()
  )
);

CREATE POLICY "job_card_parts_user_exists"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.users_login ul
    WHERE ul.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.users_login ul
    WHERE ul.id = auth.uid()
  )
);

-- ============================================
-- Verification
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

-- ============================================
-- Test: Check if current user exists in users_login
-- ============================================
SELECT 
  'User Check' as test_name,
  auth.uid() as auth_user_id,
  EXISTS (
    SELECT 1 FROM public.users_login ul WHERE ul.id = auth.uid()
  ) as user_exists_in_table;

