-- CLEAN FIX: Drop ALL policies and create ONE simple policy
-- This will definitely work

-- ============================================
-- Step 1: Drop ALL existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_select_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_insert_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_update_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_select_policy" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_card_parts_all_policy" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_allow_authenticated" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_allow_authenticated" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_select_allowed" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_insert_allowed" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_update_allowed" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_select_allowed" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_card_parts_all_allowed" ON public.job_card_parts;

-- ============================================
-- Step 2: Ensure RLS is enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create ONE simple policy for job_cards
-- ============================================
CREATE POLICY "job_cards_simple_access"
ON public.job_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Step 4: Create ONE simple policy for job_card_parts
-- ============================================
CREATE POLICY "job_card_parts_simple_access"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Step 5: Verify
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
-- Step 6: Test (uncomment to test)
-- ============================================
-- SELECT COUNT(*) FROM public.job_cards;
-- SELECT COUNT(*) FROM public.job_card_parts;

