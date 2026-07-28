-- ============================================
-- Update pricing_share_link WhatsApp template
-- Matches telecaller session message when sharing
-- time-limited pricing page (myfng.in/pricing/{slug}).
--
-- Super Admin → WhatsApp Templates → open Pricing Share Link
-- → Push to Meta for approval (if body changed vs Meta).
--
-- Run in Supabase SQL Editor, then refresh WhatsApp Templates.
-- ============================================

BEGIN;

UPDATE public.whatsapp_templates
SET
  display_name = 'Pricing Share Link',
  language_code = 'en',
  category = 'UTILITY',
  body_text = E'Hi {{1}},\n\nSharing MyFNG *full service pricing* for *{{2}}*.\n\nView all packages (Periodic, AC, Engine, Denting & more) here — valid until {{3}}:\n{{4}}\n\nSelect plans on the page and send back on WhatsApp, or reply *BOOK*. — Team MyFNG',
  variable_keys = '["customer_name","car_model","expiry_date_time","pricing_url"]'::jsonb,
  example_values = '["Yunick","MARUTI WAGON R","28 Jul, 08:21 pm","https://myfng.in/pricing/ukpjtath3f"]'::jsonb,
  -- status NOT_SYNCED so admin UI shows the Push button
  meta = jsonb_build_object(
    'purpose', 'telecaller_pricing_share',
    'source', 'local_draft',
    'meta_submit_note', 'UTILITY — telecaller pricing page link with expiry. Session text uses same copy when 24h window is open.',
    'status', 'NOT_SYNCED'
  ),
  is_active = false,
  updated_at = NOW()
WHERE template_name = 'pricing_share_link';

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
)
SELECT
  'pricing_share_link',
  'Pricing Share Link',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nSharing MyFNG *full service pricing* for *{{2}}*.\n\nView all packages (Periodic, AC, Engine, Denting & more) here — valid until {{3}}:\n{{4}}\n\nSelect plans on the page and send back on WhatsApp, or reply *BOOK*. — Team MyFNG',
  '["customer_name","car_model","expiry_date_time","pricing_url"]'::jsonb,
  '["Yunick","MARUTI WAGON R","28 Jul, 08:21 pm","https://myfng.in/pricing/ukpjtath3f"]'::jsonb,
  false,
  jsonb_build_object(
    'purpose', 'telecaller_pricing_share',
    'source', 'local_draft',
    'meta_submit_note', 'UTILITY — telecaller pricing page link with expiry. Session text uses same copy when 24h window is open.',
    'status', 'NOT_SYNCED'
  ),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates WHERE template_name = 'pricing_share_link'
);

COMMIT;

-- Verify:
-- SELECT template_name, display_name, is_active, body_text, variable_keys, example_values
-- FROM public.whatsapp_templates
-- WHERE template_name = 'pricing_share_link';
