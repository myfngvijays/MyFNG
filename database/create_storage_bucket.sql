-- ============================================
-- SIMPLE STORAGE BUCKET SETUP (Run in SQL Editor)
-- Use this if you have SQL Editor access in Supabase Dashboard
-- ============================================

-- Create or update the service-media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-media',
  'service-media',
  true,  -- Public bucket
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'service-media';

