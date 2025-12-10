-- ============================================
-- COMPLETE ROLE SETUP - DIGITAL_AUTHOR & DIGITAL_MARKETING
-- Run this file to add DIGITAL_AUTHOR and update DIGITAL_MARKETING
-- ============================================

-- ============================================
-- PART 1: Add/Update DIGITAL_AUTHOR Role
-- ============================================

INSERT INTO public.roles (
  role_code, 
  role_name, 
  description, 
  permissions, 
  is_active,
  created_at,
  updated_at
) VALUES (
  'DIGITAL_AUTHOR',
  'Digital Author',
  'Creates and manages blog content, saves drafts, and writes articles',
  '{
    "create_blogs": true,
    "save_drafts": true,
    "edit_own_blogs": true
  }'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (role_code) 
DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================
-- PART 2: Update DIGITAL_MARKETING Role
-- Merges existing permissions with new blog permissions
-- ============================================

-- Get existing permissions and merge with new blog permissions
UPDATE public.roles
SET 
  permissions = (
    SELECT jsonb_object_agg(key, value)
    FROM (
      -- Existing permissions
      SELECT key, value
      FROM jsonb_each(permissions)
      WHERE role_code = 'DIGITAL_MARKETING'
      
      UNION ALL
      
      -- New blog permissions (will override if keys exist)
      SELECT 'edit_blogs', 'true'::jsonb
      UNION ALL SELECT 'approve_blogs', 'true'::jsonb
      UNION ALL SELECT 'publish_blogs', 'true'::jsonb
      UNION ALL SELECT 'delete_blogs', 'true'::jsonb
      UNION ALL SELECT 'manage_categories', 'true'::jsonb
      UNION ALL SELECT 'manage_tags', 'true'::jsonb
      UNION ALL SELECT 'restore_versions', 'true'::jsonb
    ) AS merged_perms
  ),
  updated_at = NOW()
WHERE role_code = 'DIGITAL_MARKETING';

-- Alternative: Simple merge using || operator (keeps existing, adds new)
UPDATE public.roles
SET 
  permissions = COALESCE(permissions, '{}'::jsonb) || '{
    "edit_blogs": true,
    "approve_blogs": true,
    "publish_blogs": true,
    "delete_blogs": true,
    "manage_categories": true,
    "manage_tags": true,
    "restore_versions": true
  }'::jsonb,
  updated_at = NOW()
WHERE role_code = 'DIGITAL_MARKETING'
  AND NOT (
    permissions ? 'edit_blogs' 
    AND permissions ? 'publish_blogs' 
    AND permissions ? 'manage_categories'
  );

-- ============================================
-- PART 3: Verification Query
-- ============================================

SELECT 
  role_code,
  role_name,
  description,
  permissions,
  is_active,
  created_at,
  updated_at
FROM public.roles
WHERE role_code IN ('DIGITAL_MARKETING', 'DIGITAL_AUTHOR')
ORDER BY role_code;

-- ============================================
-- PART 4: Success Messages
-- ============================================

DO $$
DECLARE
  digital_author_count INTEGER;
  digital_marketing_has_blogs BOOLEAN;
BEGIN
  -- Check DIGITAL_AUTHOR
  SELECT COUNT(*) INTO digital_author_count
  FROM public.roles
  WHERE role_code = 'DIGITAL_AUTHOR' AND is_active = true;
  
  -- Check DIGITAL_MARKETING permissions
  SELECT (permissions ? 'publish_blogs' AND permissions ? 'manage_categories') 
  INTO digital_marketing_has_blogs
  FROM public.roles
  WHERE role_code = 'DIGITAL_MARKETING';
  
  IF digital_author_count > 0 THEN
    RAISE NOTICE '✅ DIGITAL_AUTHOR role: ADDED/UPDATED successfully';
  ELSE
    RAISE NOTICE '❌ ERROR: DIGITAL_AUTHOR role was not created';
  END IF;
  
  IF digital_marketing_has_blogs THEN
    RAISE NOTICE '✅ DIGITAL_MARKETING role: Updated with blog management permissions';
  ELSE
    RAISE NOTICE '⚠️  WARNING: DIGITAL_MARKETING may need manual update';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '   1. Verify roles in Supabase Dashboard';
  RAISE NOTICE '   2. Assign DIGITAL_AUTHOR role to appropriate users';
  RAISE NOTICE '   3. Test blog creation and management';
END $$;
