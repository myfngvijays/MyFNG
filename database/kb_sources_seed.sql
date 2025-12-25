-- KB Sources Seed (docs + website/blog)
-- Prereq: database/kb_vector_setup.sql already run (kb_sources table exists)
-- Note: Update URLs to your production domain.

-- 1) URL sources (docs/marketing/services)
insert into public.kb_sources (source_type, source_key, title, config)
values
  ('url', 'url:https://myfng.in/', 'MYFNG Home', jsonb_build_object('url','https://myfng.in/','doc_type','marketing','language','en')),
  ('url', 'url:https://myfng.in/about.php', 'About MYFNG', jsonb_build_object('url','https://myfng.in/about.php','doc_type','marketing','language','en')),
  ('url', 'url:https://myfng.in/contact.php', 'Contact MYFNG', jsonb_build_object('url','https://myfng.in/contact.php','doc_type','marketing','language','en')),
  ('url', 'url:https://myfng.in/faq.php', 'FAQ', jsonb_build_object('url','https://myfng.in/faq.php','doc_type','faq','language','mixed')),
  ('url', 'url:https://myfng.in/terms-and-conditions.php', 'Terms & Conditions', jsonb_build_object('url','https://myfng.in/terms-and-conditions.php','doc_type','policy','language','en')),
  ('url', 'url:https://myfng.in/privacy.php', 'Privacy Policy', jsonb_build_object('url','https://myfng.in/privacy.php','doc_type','policy','language','en')),
  ('url', 'url:https://myfng.in/blogs/', 'Blogs Index', jsonb_build_object('url','https://myfng.in/blogs/','doc_type','blog','language','mixed')),
  ('url', 'url:https://myfng.in/services/periodic-service', 'Service: Periodic Service', jsonb_build_object('url','https://myfng.in/services/periodic-service','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/ac-service', 'Service: AC Service', jsonb_build_object('url','https://myfng.in/services/ac-service','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/engine-service', 'Service: Engine Service', jsonb_build_object('url','https://myfng.in/services/engine-service','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/battery', 'Service: Battery', jsonb_build_object('url','https://myfng.in/services/battery','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/tyre-wheel-care', 'Service: Tyre & Wheel Care', jsonb_build_object('url','https://myfng.in/services/tyre-wheel-care','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/brake-service', 'Service: Brake Service', jsonb_build_object('url','https://myfng.in/services/brake-service','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/clutch-service', 'Service: Clutch Service', jsonb_build_object('url','https://myfng.in/services/clutch-service','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/denting-painting', 'Service: Denting & Painting', jsonb_build_object('url','https://myfng.in/services/denting-painting','doc_type','service','language','en')),
  ('url', 'url:https://myfng.in/services/detailing-service', 'Service: Detailing Service', jsonb_build_object('url','https://myfng.in/services/detailing-service','doc_type','service','language','en'))
on conflict (source_key) do update set
  is_active = true,
  title = excluded.title,
  config = excluded.config,
  updated_at = now();

-- 2) Table sources (high-signal text)
-- Telecaller scripts (objections/FAQs)
insert into public.kb_sources (source_type, source_key, title, config)
values (
  'table',
  'table:telecaller_scripts',
  'Telecaller scripts (objections/FAQs)',
  jsonb_build_object(
    'table', 'telecaller_scripts',
    'id_column', 'id',
    'title_column', 'script_title',
    'content_column', 'script_content',
    'doc_type', 'faq',
    'language', 'mixed',
    'limit', 500
  )
)
on conflict (source_key) do update set
  is_active = true,
  title = excluded.title,
  config = excluded.config,
  updated_at = now();

-- Blogs (published content still filtered by RLS; kb-ingest uses service_role so it can read)
insert into public.kb_sources (source_type, source_key, title, config)
values (
  'table',
  'table:blogs',
  'Blogs (content)',
  jsonb_build_object(
    'table', 'blogs',
    'id_column', 'id',
    'title_column', 'title',
    'content_column', 'content',
    'doc_type', 'blog',
    'language', 'mixed',
    'limit', 500
  )
)
on conflict (source_key) do update set
  is_active = true,
  title = excluded.title,
  config = excluded.config,
  updated_at = now();

-- Workshop public pages (use full_description)
insert into public.kb_sources (source_type, source_key, title, config)
values (
  'table',
  'table:workshop_public_pages',
  'Workshop public pages (descriptions)',
  jsonb_build_object(
    'table', 'workshop_public_pages',
    'id_column', 'id',
    'title_column', 'slug',
    'content_column', 'full_description',
    'doc_type', 'workshop',
    'language', 'mixed',
    'limit', 1000
  )
)
on conflict (source_key) do update set
  is_active = true,
  title = excluded.title,
  config = excluded.config,
  updated_at = now();


