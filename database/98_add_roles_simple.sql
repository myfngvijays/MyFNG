-- ============================================
-- ADD DIGITAL_AUTHOR ROLE & UPDATE DIGITAL_MARKETING
-- Simple INSERT/UPDATE statements matching your format
-- ============================================

-- ============================================
-- 1. Add DIGITAL_AUTHOR Role
-- ============================================

INSERT INTO "public"."roles" (
  "role_code", 
  "role_name", 
  "description", 
  "permissions", 
  "is_active", 
  "created_at", 
  "updated_at"
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
  "role_name" = EXCLUDED."role_name",
  "description" = EXCLUDED."description",
  "permissions" = EXCLUDED."permissions",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = NOW();

-- ============================================
-- 2. Update DIGITAL_MARKETING Role
-- Adds blog management permissions to existing role
-- ============================================

UPDATE "public"."roles"
SET 
  "permissions" = '{
    "track_leads": true,
    "manage_content": true,
    "view_analytics": true,
    "manage_campaigns": true,
    "manage_promotions": true,
    "edit_blogs": true,
    "approve_blogs": true,
    "publish_blogs": true,
    "delete_blogs": true,
    "manage_categories": true,
    "manage_tags": true,
    "restore_versions": true
  }'::jsonb,
  "updated_at" = NOW()
WHERE "role_code" = 'DIGITAL_MARKETING';

-- ============================================
-- 3. Verification
-- ============================================

SELECT 
  role_code,
  role_name,
  permissions
FROM "public"."roles"
WHERE role_code IN ('DIGITAL_MARKETING', 'DIGITAL_AUTHOR')
ORDER BY role_code;
