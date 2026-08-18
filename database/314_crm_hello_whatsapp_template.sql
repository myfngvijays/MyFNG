-- CRM Hello utility template for telecallers (open 24h session outside customer care window).
-- After migrate: Super Admin → WhatsApp Templates → push/create on Meta → wait for UTILITY APPROVED.

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
  'crm_hello',
  'CRM Hello',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nThis is MyFNG support on WhatsApp.\n\nHow can we help you with your car service today?\n\nReply to this message and our team will assist you.',
  '["customer_name"]'::jsonb,
  '["Customer"]'::jsonb,
  true,
  jsonb_build_object(
    'crm_telecaller', true,
    'opens_session', true,
    'purpose', 'Open customer care window with a simple hello'
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
  is_active = true,
  meta = COALESCE(public.whatsapp_templates.meta, '{}'::jsonb) || EXCLUDED.meta,
  updated_at = NOW();
