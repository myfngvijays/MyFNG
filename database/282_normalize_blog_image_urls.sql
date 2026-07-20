-- Normalize blog image URLs from Supabase public storage to same-site /media/* paths
-- (served via Next.js rewrite to Supabase storage, same as service page images)

UPDATE public.blogs
SET featured_image = regexp_replace(
  featured_image,
  '^https?://[^/]+\.supabase\.co/storage/v1/object/public/',
  '/media/'
)
WHERE featured_image ~* '\.supabase\.co/storage/v1/object/public/';

UPDATE public.blogs
SET seo_data = jsonb_set(
  seo_data,
  '{og_image}',
  to_jsonb(
    regexp_replace(
      seo_data->>'og_image',
      '^https?://[^/]+\.supabase\.co/storage/v1/object/public/',
      '/media/'
    )
  )
)
WHERE coalesce(seo_data->>'og_image', '') ~* '\.supabase\.co/storage/v1/object/public/';

UPDATE public.blogs
SET content = regexp_replace(
  content,
  'https?://[^''"\s>]+\.supabase\.co/storage/v1/object/public/',
  '/media/',
  'gi'
)
WHERE content ~* '\.supabase\.co/storage/v1/object/public/';

UPDATE public.blog_images
SET image_url = regexp_replace(
  image_url,
  '^https?://[^/]+\.supabase\.co/storage/v1/object/public/',
  '/media/'
)
WHERE image_url ~* '\.supabase\.co/storage/v1/object/public/';
