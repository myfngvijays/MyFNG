-- FINAL WORKING SOLUTION
-- This version uses a function to check authentication properly

-- ============================================
-- Step 1: Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_simple_access" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_simple_access" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_allow_all" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_allow_all" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_authenticated_only" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_authenticated_only" ON public.job_card_parts;

-- ============================================
-- Step 2: Ensure RLS is enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create helper function to check if user exists
-- ============================================
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- ============================================
-- Step 4: Create policy using the function
-- ============================================
CREATE POLICY "job_cards_allow_authenticated_users"
ON public.job_cards
FOR ALL
TO authenticated
USING (public.is_authenticated_user())
WITH CHECK (public.is_authenticated_user());

CREATE POLICY "job_card_parts_allow_authenticated_users"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (public.is_authenticated_user())
WITH CHECK (public.is_authenticated_user());

-- ============================================
-- Step 5: Verification
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('job_cards', 'job_card_parts')
ORDER BY tablename, policyname;

-- ============================================
-- Step 6: Test query (should work if authenticated)
-- ============================================
-- Uncomment to test:
-- SELECT COUNT(*) FROM public.job_cards;

