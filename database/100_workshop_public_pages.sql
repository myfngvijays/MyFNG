-- ================================================================
-- WORKSHOP PUBLIC PAGES TABLE
-- ================================================================
-- Table to store public-facing workshop pages
-- Each workshop can have one public page accessible via /workshop/{slug}
-- ================================================================

CREATE TABLE IF NOT EXISTS public.workshop_public_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL UNIQUE REFERENCES public.workshops(id) ON DELETE CASCADE,
  
  -- URL slug (e.g., "delhi-auto-care" for www.domain.in/workshop/delhi-auto-care)
  slug VARCHAR(255) NOT NULL UNIQUE,
  
  -- Profile/Header Image
  profile_image TEXT,
  cover_image TEXT,
  
  -- Description & Content
  short_description TEXT,
  full_description TEXT,
  
  -- Services offered (can be JSON array or comma-separated)
  services_offered JSONB DEFAULT '[]'::jsonb,
  
  -- Business Hours
  business_hours JSONB DEFAULT '{}'::jsonb, -- { "monday": "9:00 AM - 6:00 PM", ... }
  
  -- Contact & Social Media
  whatsapp_number VARCHAR(20),
  alternate_phone VARCHAR(20),
  website_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  google_maps_url TEXT,
  
  -- Gallery Images (array of image URLs)
  -- Minimum 2 images required, maximum 25 images allowed
  gallery_images JSONB DEFAULT '[]'::jsonb NOT NULL,
  
  -- SEO Fields
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Status & Visibility
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  
  -- Statistics
  views_count INT DEFAULT 0,
  clicks_count INT DEFAULT 0,
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id),
  updated_by UUID REFERENCES public.users_login(id),
  
  CONSTRAINT workshop_public_pages_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT workshop_public_pages_gallery_min CHECK (jsonb_array_length(gallery_images) >= 2),
  CONSTRAINT workshop_public_pages_gallery_max CHECK (jsonb_array_length(gallery_images) <= 25)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workshop_public_pages_workshop_id ON public.workshop_public_pages(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_public_pages_slug ON public.workshop_public_pages(slug);
CREATE INDEX IF NOT EXISTS idx_workshop_public_pages_published ON public.workshop_public_pages(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_workshop_public_pages_featured ON public.workshop_public_pages(is_featured) WHERE is_featured = true;

-- RLS Policies
ALTER TABLE public.workshop_public_pages ENABLE ROW LEVEL SECURITY;

-- Public can view published pages
CREATE POLICY "Public can view published workshop pages"
  ON public.workshop_public_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Super Admin can do everything
CREATE POLICY "Super Admin can manage workshop public pages"
  ON public.workshop_public_pages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
    )
  );

-- Workshop Owner/Admin can view and manage their own workshop's public page
CREATE POLICY "Workshop owner can view own workshop public page"
  ON public.workshop_public_pages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      WHERE ul.id = auth.uid() 
        AND ul.workshop_id = workshop_public_pages.workshop_id
        AND (
          EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = ul.role_id 
            AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
          )
        )
    )
  );

CREATE POLICY "Workshop owner can update own workshop public page"
  ON public.workshop_public_pages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      WHERE ul.id = auth.uid() 
        AND ul.workshop_id = workshop_public_pages.workshop_id
        AND (
          EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = ul.role_id 
            AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
          )
        )
    )
  );

CREATE POLICY "Workshop owner can insert own workshop public page"
  ON public.workshop_public_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      WHERE ul.id = auth.uid() 
        AND ul.workshop_id = workshop_public_pages.workshop_id
        AND (
          EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = ul.role_id 
            AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
          )
        )
    )
  );

-- Comments
COMMENT ON TABLE public.workshop_public_pages IS 'Public-facing pages for workshops accessible via /workshop/{slug}';
COMMENT ON COLUMN public.workshop_public_pages.slug IS 'URL-friendly identifier (e.g., "delhi-auto-care")';
COMMENT ON COLUMN public.workshop_public_pages.services_offered IS 'Array of services offered by the workshop';
COMMENT ON COLUMN public.workshop_public_pages.business_hours IS 'JSON object with business hours for each day';
COMMENT ON COLUMN public.workshop_public_pages.gallery_images IS 'Array of image URLs for gallery';
COMMENT ON COLUMN public.workshop_public_pages.is_published IS 'Whether the page is publicly accessible';
COMMENT ON COLUMN public.workshop_public_pages.is_featured IS 'Whether to feature this workshop on homepage';

-- ================================================================
-- SAMPLE DATA
-- ================================================================
-- Sample workshop public page for Vijay Workshop, Mumbai
-- ================================================================

INSERT INTO public.workshop_public_pages (
  workshop_id,
  slug,
  profile_image,
  cover_image,
  short_description,
  full_description,
  services_offered,
  business_hours,
  whatsapp_number,
  alternate_phone,
  website_url,
  facebook_url,
  instagram_url,
  youtube_url,
  google_maps_url,
  gallery_images,
  meta_title,
  meta_description,
  meta_keywords,
  is_published,
  is_featured,
  views_count,
  clicks_count,
  published_at
) VALUES (
  'c248e9cc-359f-4131-a4ec-4cd4837dcb54'::uuid, -- Vijay Workshop ID
  'vijay-workshop-mumbai',
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&h=400&fit=crop',
  'Premier auto service center in Mumbai offering comprehensive car maintenance, repair, and detailing services with expert technicians and state-of-the-art equipment.',
  'Welcome to Vijay Workshop, your trusted automotive service partner in Mumbai! We specialize in providing high-quality car maintenance and repair services to keep your vehicle running smoothly.

With years of experience and a team of skilled technicians, we offer:
- Complete diagnostic services
- Engine repair and maintenance
- AC service and repair
- Brake and clutch services
- Battery replacement and charging
- Tyre services
- Car detailing and washing
- Paint and denting work

Our workshop is equipped with modern tools and genuine parts to ensure the best service for your vehicle. Customer satisfaction is our top priority, and we guarantee quality workmanship at competitive prices.

Visit us today and experience the difference!',
  '[
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1592503254549-d83d24a4dfab?w=800&h=600&fit=crop"
  ]'::jsonb,
  '{
    "monday": "9:00 AM - 7:00 PM",
    "tuesday": "9:00 AM - 7:00 PM",
    "wednesday": "9:00 AM - 7:00 PM",
    "thursday": "9:00 AM - 7:00 PM",
    "friday": "9:00 AM - 7:00 PM",
    "saturday": "9:00 AM - 6:00 PM",
    "sunday": "Closed"
  }'::jsonb,
  '9999999999',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'https://maps.google.com/?q=Mumbai+400061',
  '[
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1592503254549-d83d24a4dfab?w=800&h=600&fit=crop"
  ]'::jsonb,
  'Vijay Workshop Mumbai - Best Car Service Center | AC, Battery, Brake Repair',
  'Vijay Workshop in Mumbai offers expert car servicing, AC repair, battery replacement, brake service, and more. Trusted auto service center with skilled technicians. Book now!',
  ARRAY['car service mumbai', 'auto workshop mumbai', 'car repair mumbai', 'AC service mumbai', 'battery service mumbai', 'brake service mumbai', 'vijay workshop'],
  true, -- is_published
  true, -- is_featured
  0, -- views_count
  0, -- clicks_count
  NOW() -- published_at
) ON CONFLICT (workshop_id) DO NOTHING;
