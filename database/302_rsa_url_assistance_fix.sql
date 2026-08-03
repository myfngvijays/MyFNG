-- Fix RSA page URL typo: assitance -> assistance (matches footer canonical link)
UPDATE public.site_page_seo
SET
  page_path = '/car-roadside-assistance',
  canonical_path = '/car-roadside-assistance',
  updated_at = NOW()
WHERE page_path = '/car-roadside-assitance';

INSERT INTO public.site_page_seo (
  page_path,
  page_label,
  title,
  description,
  keywords,
  keyphrase,
  canonical_path,
  city,
  noindex,
  display_order
)
SELECT
  '/car-roadside-assistance',
  'Roadside Assistance',
  'Roadside Assistance (RSA) - 24x7 Emergency Help | MyFNG',
  'MYFNG Roadside Assistance - 24x7 emergency dispatch for towing, jumpstart, puncture repair, fuel delivery & on-road help across Mumbai & Pune.',
  'roadside assistance, car breakdown help, emergency towing, RSA Mumbai, RSA Pune',
  'roadside assistance near me',
  '/car-roadside-assistance',
  'Mumbai',
  FALSE,
  9
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_page_seo s WHERE s.page_path = '/car-roadside-assistance'
);
