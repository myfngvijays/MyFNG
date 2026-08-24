-- Meta reclassified workshop_proximity_account_update as MARKETING again
-- ("Open the MyFNG app" / "walk-in assistance" still reads as promotional).
-- Ultra-dry account-status copy only — no CTA, no benefits language.
BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta
) VALUES (
  'workshop_near_account_status',
  'Workshop Proximity',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update for your MyFNG profile.\n\nStatus: your location is near service center {{2}}.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","workshop_name"]'::jsonb,
  '["Nikhil","MyFNG Thane Vartak Nagar"]'::jsonb,
  false,
  jsonb_build_object(
    'purpose', 'workshop_proximity',
    'source', 'local_draft',
    'replaces', 'workshop_proximity_account_update',
    'note', 'No CTA / benefits / open-app wording — Meta keeps reclassifying softer CTAs as MARKETING'
  )
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();

UPDATE public.whatsapp_automation_settings SET
  template_name = 'workshop_near_account_status',
  template_body = E'Hi {{1}},\n\nAccount update for your MyFNG profile.\n\nStatus: your location is near service center {{2}}.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","workshop_name"]'::jsonb,
  template_category = 'UTILITY',
  description = 'Sent when a customer with the app enters a workshop geofence without an active booking (along with app push). Pure account-status copy for Meta UTILITY.',
  updated_at = NOW()
WHERE trigger_key = 'workshop_proximity';

UPDATE public.whatsapp_templates SET
  is_active = false,
  updated_at = NOW()
WHERE template_name IN (
  'workshop_proximity_alert',
  'workshop_proximity_nearby',
  'workshop_proximity_account_update'
);

COMMIT;
