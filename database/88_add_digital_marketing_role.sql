-- ============================================
-- Add DIGITAL_MARKETING Role
-- ============================================

-- Insert DIGITAL_MARKETING role
INSERT INTO public.roles (role_code, role_name, description, permissions) 
VALUES (
  'DIGITAL_MARKETING',
  'Digital Marketing',
  'Manages marketing campaigns, analytics, lead generation, and promotional activities',
  '{"manage_campaigns": true, "view_analytics": true, "manage_promotions": true, "track_leads": true, "manage_content": true}'::jsonb
)
ON CONFLICT (role_code) DO UPDATE
SET 
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- Verify the role was added
SELECT role_code, role_name, description, permissions 
FROM public.roles 
WHERE role_code = 'DIGITAL_MARKETING';

COMMENT ON TABLE roles IS 'All user roles including DIGITAL_MARKETING for marketing campaigns and analytics';
