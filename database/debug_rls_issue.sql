-- Debug RLS Issue - Check actual values
-- Run this to see what's actually in the database

-- ============================================
-- 1. Check current authenticated user
-- ============================================
SELECT 
  'Current Auth User' as check_type,
  auth.uid() as auth_user_id;

-- ============================================
-- 2. Check user details and role
-- ============================================
SELECT 
  'User Details' as check_type,
  ul.id,
  ul.email,
  ul.full_name,
  ul.workshop_id,
  r.role_code,
  r.role_name
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid();

-- ============================================
-- 3. Check lead details
-- ============================================
SELECT 
  'Lead Details' as check_type,
  sl.id,
  sl.lead_number,
  sl.workshop_id as lead_workshop_id,
  sl.assigned_mechanic_id,
  sl.status
FROM public.service_leads sl
WHERE sl.id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- 4. Check if workshop IDs match
-- ============================================
SELECT 
  'Workshop Match Check' as check_type,
  ul.workshop_id as user_workshop_id,
  sl.workshop_id as lead_workshop_id,
  (ul.workshop_id = sl.workshop_id) as workshops_match,
  (ul.workshop_id IS NOT NULL) as user_has_workshop,
  (sl.workshop_id IS NOT NULL) as lead_has_workshop
FROM public.users_login ul
CROSS JOIN public.service_leads sl
WHERE ul.id = auth.uid()
AND sl.id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- 5. Check all role codes in system
-- ============================================
SELECT 
  'All Roles' as check_type,
  role_code,
  role_name
FROM public.roles
ORDER BY role_code;

-- ============================================
-- 6. Test direct query (should work if RLS allows)
-- ============================================
SELECT 
  'Direct Query Test' as check_type,
  COUNT(*) as job_cards_count
FROM public.job_cards
WHERE lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

