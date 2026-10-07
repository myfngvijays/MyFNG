-- Category for /automobile-news. Articles stay on /blogs/:slug.
INSERT INTO public.blog_categories (name, slug, description, status)
SELECT 'Automobile News', 'automobile-news', 'New car launches, facelifts and automobile updates.', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.blog_categories WHERE slug = 'automobile-news'
);
