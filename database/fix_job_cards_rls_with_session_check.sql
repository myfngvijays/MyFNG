-- Fix RLS with proper session check
-- This version checks auth.uid() properly

-- ============================================
-- Drop existing policies
-- ============================================
DROP POLICY IF EXISTS "job_cards_simple_access" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_simple_access" ON public.job_card_parts;
DROP POLICY IF EXISTS "job_cards_allow_all" ON public.job_cards;
DROP POLICY IF EXISTS "job_card_parts_allow_all" ON public.job_card_parts;

-- ============================================
-- Ensure RLS is enabled
-- ============================================
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policy that checks auth.uid() exists (user is authenticated)
-- This is more permissive - allows any authenticated user
-- ============================================
CREATE POLICY "job_cards_authenticated_only"
ON public.job_cards
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "job_card_parts_authenticated_only"
ON public.job_card_parts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

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

