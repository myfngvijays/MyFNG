-- Grant explicit permissions to authenticated users
-- This ensures access even without RLS

-- ============================================
-- Grant SELECT, INSERT, UPDATE, DELETE to authenticated role
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_card_parts TO authenticated;

-- Also grant to anon role (for public API access if needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_card_parts TO anon;

-- ============================================
-- Verification
-- ============================================
SELECT 
  'Table Permissions' as check_type,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('job_cards', 'job_card_parts')
AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

