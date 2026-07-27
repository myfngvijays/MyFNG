-- ============================================
-- Time-limited public pricing share links
-- URL: https://myfng.in/pricing/{slug}  (also /p/{slug})  default TTL 3 hours
-- Used by telecaller Send Pricing — works for Periodic + all categories
-- ============================================

CREATE TABLE IF NOT EXISTS public.pricing_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(32) NOT NULL UNIQUE,
  lead_id UUID,
  lead_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  car_model TEXT NOT NULL,
  pincode VARCHAR(6) NOT NULL,
  city TEXT,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_type_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_share_links_slug
  ON public.pricing_share_links (slug);

CREATE INDEX IF NOT EXISTS idx_pricing_share_links_expires
  ON public.pricing_share_links (expires_at);

CREATE INDEX IF NOT EXISTS idx_pricing_share_links_lead
  ON public.pricing_share_links (lead_id);

COMMENT ON TABLE public.pricing_share_links IS
  'Telecaller-generated pricing pages: myfng.in/pricing/{slug}, expire after ~3h';

ALTER TABLE public.pricing_share_links ENABLE ROW LEVEL SECURITY;

-- Public access only via Next.js API (service role). Authenticated ops can read.
DROP POLICY IF EXISTS pricing_share_links_select_ops ON public.pricing_share_links;
CREATE POLICY pricing_share_links_select_ops
ON public.pricing_share_links
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS pricing_share_links_insert_ops ON public.pricing_share_links;
CREATE POLICY pricing_share_links_insert_ops
ON public.pricing_share_links
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Optional: Meta UTILITY template for cold send (name + car + link)
INSERT INTO public.whatsapp_templates (
  template_name,
  display_name,
  language_code,
  category,
  body_text,
  variable_keys,
  example_values,
  is_active,
  meta,
  created_at,
  updated_at
) VALUES (
  'pricing_share_link',
  'Pricing Share Link',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nSharing MyFNG service pricing for {{2}}.\n\nView plans here (valid for a limited time):\n{{3}}\n\nThis is an automated pricing update from MyFNG. Reply BOOK to proceed.',
  '["customer_name","car_model","pricing_url"]'::jsonb,
  '["Rahul","Hyundai i20","https://myfng.in/pricing/a8k2m9xq"]'::jsonb,
  false,
  '{"purpose":"telecaller_pricing_share","source":"local_draft","meta_submit_note":"UTILITY — short message with time-limited pricing page URL."}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();
