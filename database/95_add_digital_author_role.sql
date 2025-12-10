-- ============================================
-- ADD DIGITAL_AUTHOR ROLE AND UPDATE DIGITAL_MARKETING
-- Adds DIGITAL_AUTHOR role with proper permissions
-- Updates DIGITAL_MARKETING role with blog management permissions
-- ============================================

-- ============================================
-- PART 1: Add DIGITAL_AUTHOR Role
-- ============================================

INSERT INTO public.roles (
  role_code, 
  role_name, 
  description, 
  permissions, 
  is_active
) VALUES (
  'DIGITAL_AUTHOR',
  'Digital Author',
  'Creates and manages blog content, saves drafts, and writes articles',
  '{
    "create_blogs": true,
    "save_drafts": true,
    "edit_own_blogs": true
  }'::jsonb,
  true
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
-- Add blog management permissions to existing DIGITAL_MARKETING role
-- ============================================

UPDATE public.roles
SET 
  permissions = jsonb_build_object(
    'track_leads', COALESCE(permissions->>'track_leads', 'true')::boolean,
    'manage_content', COALESCE(permissions->>'manage_content', 'true')::boolean,
    'view_analytics', COALESCE(permissions->>'view_analytics', 'true')::boolean,
    'manage_campaigns', COALESCE(permissions->>'manage_campaigns', 'true')::boolean,
    'manage_promotions', COALESCE(permissions->>'manage_promotions', 'true')::boolean,
    'edit_blogs', true,
    'approve_blogs', true,
    'publish_blogs', true,
    'delete_blogs', true,
    'manage_categories', true,
    'manage_tags', true,
    'restore_versions', true
  ),
  updated_at = NOW()
WHERE role_code = 'DIGITAL_MARKETING';

-- ============================================
-- PART 3: Verification
-- ============================================

DO $$
DECLARE
  digital_author_exists BOOLEAN;
  digital_marketing_permissions JSONB;
BEGIN
  -- Check if DIGITAL_AUTHOR role exists
  SELECT EXISTS(
    SELECT 1 FROM public.roles WHERE role_code = 'DIGITAL_AUTHOR'
  ) INTO digital_author_exists;
  
  IF digital_author_exists THEN
    RAISE NOTICE '✅ DIGITAL_AUTHOR role added/updated successfully';
  ELSE
    RAISE NOTICE '❌ ERROR: DIGITAL_AUTHOR role was not created';
  END IF;
  
  -- Check DIGITAL_MARKETING permissions
  SELECT permissions INTO digital_marketing_permissions
  FROM public.roles
  WHERE role_code = 'DIGITAL_MARKETING';
  
  IF digital_marketing_permissions ? 'publish_blogs' AND digital_marketing_permissions ? 'manage_categories' THEN
    RAISE NOTICE '✅ DIGITAL_MARKETING role updated with blog permissions';
    RAISE NOTICE '   Permissions: %', digital_marketing_permissions;
  ELSE
    RAISE NOTICE '⚠️  WARNING: DIGITAL_MARKETING permissions may not be complete';
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.roles IS 'All user roles including DIGITAL_AUTHOR and updated DIGITAL_MARKETING with blog permissions';
