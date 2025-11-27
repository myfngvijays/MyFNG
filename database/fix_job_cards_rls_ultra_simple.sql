-- ULTRA SIMPLE RLS Policy - Maximum Permissiveness
-- This should definitely work for all authenticated users

-- ============================================
-- Drop all existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_select_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_insert_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_cards_update_policy" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_select_policy" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_card_parts_all_policy" ON public.job_card_parts;

-- ============================================
-- ULTRA SIMPLE: Allow all authenticated users
-- ============================================
-- This is the most permissive policy - allows any authenticated user
-- We can tighten it later once we know the exact issue

CREATE POLICY "job_cards_allow_authenticated"
ON public.job_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "job_card_parts_allow_authenticated"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Verification
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
-- Test Query (should work now)
-- ============================================
-- Uncomment to test:
-- SELECT * FROM public.job_cards LIMIT 1;

