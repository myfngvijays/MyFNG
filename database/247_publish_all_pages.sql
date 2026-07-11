-- Publish all workshop public pages and set published_at
UPDATE public.workshop_public_pages
SET is_published = true,
    published_at = COALESCE(published_at, NOW())
WHERE is_published = false;
