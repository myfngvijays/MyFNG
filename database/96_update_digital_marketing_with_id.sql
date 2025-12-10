-- ============================================
-- UPDATE DIGITAL_MARKETING ROLE (If you have specific ID)
-- Use this if you need to update the role with a specific UUID
-- ============================================

-- Option 1: Update by ID (if you have the exact ID)
-- Replace '228aaa17-472f-43ee-92a4-bcb9b0724fc7' with your actual ID if different
UPDATE public.roles
SET 
  permissions = '{
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
  updated_at = NOW()
WHERE id = '228aaa17-472f-43ee-92a4-bcb9b0724fc7'
  AND role_code = 'DIGITAL_MARKETING';

-- Option 2: Update by role_code (safer, works regardless of ID)
UPDATE public.roles
SET 
  permissions = '{
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
  updated_at = NOW()
WHERE role_code = 'DIGITAL_MARKETING';

-- Verification
SELECT 
  role_code,
  role_name,
  permissions
FROM public.roles
WHERE role_code IN ('DIGITAL_MARKETING', 'DIGITAL_AUTHOR')
ORDER BY role_code;
