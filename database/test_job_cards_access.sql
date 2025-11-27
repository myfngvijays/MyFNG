-- Test script to debug job_cards RLS access
-- Run this to check why 406 error is happening

-- ============================================
-- 1. Check current user and role
-- ============================================
SELECT 
  auth.uid() as current_user_id,
  ul.id as user_id,
  ul.email,
  ul.workshop_id,
  r.role_code,
  r.role_name
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid();

-- ============================================
-- 2. Check if lead exists and workshop_id
-- ============================================
SELECT 
  id,
  lead_number,
  workshop_id,
  assigned_mechanic_id,
  status
FROM public.service_leads
WHERE id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- 3. Check if job_card exists for this lead
-- ============================================
SELECT 
  id,
  lead_id,
  job_card_number,
  created_by
FROM public.job_cards
WHERE lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- 4. Test RLS policy manually
-- ============================================
-- This simulates what the RLS policy checks
SELECT 
  'Workshop Admin Check' as test_name,
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_ADMIN'
  ) as is_workshop_admin,
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a'
    AND sl.workshop_id = (
      SELECT ul2.workshop_id 
      FROM public.users_login ul2 
      WHERE ul2.id = auth.uid()
    )
  ) as workshop_matches;

-- ============================================
-- 5. Temporary: Disable RLS to test (REMOVE AFTER TESTING)
-- ============================================
-- ALTER TABLE public.job_cards DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.job_card_parts DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Re-enable RLS after testing
-- ============================================
-- ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.job_card_parts ENABLE ROW LEVEL SECURITY;

