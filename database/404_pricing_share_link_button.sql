-- Pricing share WhatsApp template with URL button (slug in button, not body line).
-- Same copy as pricing_share_link — link opens from "Pricing link" button.
--
-- Body: {{1}} name, {{2}} car, {{3}} expiry (IST label)
-- Button URL: https://myfng.in/pricing/{{1}}  → send slug only in button_url_params
--
-- Run in Supabase SQL Editor → Super Admin → WhatsApp Templates → Push `pricing_share_link_btn` → Meta approve.
-- Then telecaller Send Pricing uses this template when 24h window is closed.

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
VALUES (
  'pricing_share_link_btn',
  'Pricing Share Link · URL button',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nSharing MyFNG *full service pricing* for *{{2}}*.\n\nView all packages (Periodic, AC, Engine, Denting & more) — valid until {{3}}.\n\nSelect plans on the page and send back on WhatsApp, or reply *BOOK*. — Team MyFNG',
  '["customer_name","car_model","expiry_date_time"]'::jsonb,
  '["Yunick","MARUTI WAGON R","28 Jul, 08:21 pm"]'::jsonb,
  true,
  jsonb_build_object(
    'purpose', 'telecaller_pricing_share',
    'source', 'local_draft',
    'pricing_slug_button', true,
    'meta_submit_note',
    'UTILITY — same pricing copy; URL on CTA button "Pricing link" (dynamic slug). No raw link in body.',
    'status', 'NOT_SYNCED',
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text',
        E'Hi {{1}},\n\nSharing MyFNG *full service pricing* for *{{2}}*.\n\nView all packages (Periodic, AC, Engine, Denting & more) — valid until {{3}}.\n\nSelect plans on the page and send back on WhatsApp, or reply *BOOK*. — Team MyFNG',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array('Yunick', 'MARUTI WAGON R', '28 Jul, 08:21 pm')
          )
        )
      ),
      jsonb_build_object(
        'type', 'BUTTONS',
        'buttons', jsonb_build_array(
          jsonb_build_object(
            'type', 'URL',
            'text', 'Pricing link',
            'url', 'https://myfng.in/pricing/{{1}}',
            'example', jsonb_build_array('ukpjtath3f')
          )
        )
      )
    )
  ),
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  language_code = EXCLUDED.language_code,
  category = EXCLUDED.category,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  is_active = EXCLUDED.is_active,
  meta = EXCLUDED.meta,
  updated_at = NOW();