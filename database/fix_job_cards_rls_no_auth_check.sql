-- TEMPORARY: Allow access without authentication check
-- Use this ONLY for testing to verify RLS is the issue

-- ============================================
-- Drop existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_simple_access" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_simple_access" ON public.job_card_parts;

-- ============================================
-- Create policy that allows ALL (even unauthenticated)
-- WARNING: This is INSECURE - use only for testing!
-- ============================================
CREATE POLICY "job_cards_allow_all"
ON public.job_cards
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "job_card_parts_allow_all"
ON public.job_card_parts
FOR ALL
TO public
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

