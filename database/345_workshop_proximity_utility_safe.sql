-- Meta reclassified workshop_proximity_nearby as MARKETING (promotional "book / wallet benefits" wording).
-- Switch to UTILITY-safe account-update copy + new Meta template name.
BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta
) VALUES (
  'workshop_proximity_account_update',
  'Workshop Proximity',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app for walk-in assistance at this location.\n\nThis is an automated location notification.\n\nThank you.',
  '["customer_name","workshop_name"]'::jsonb,
  '["Nikhil","MyFNG Thane Vartak Nagar"]'::jsonb,
  false,
  jsonb_build_object(
    'purpose', 'workshop_proximity',
    'source', 'local_draft',
    'replaces', 'workshop_proximity_nearby',
    'note', 'UTILITY-safe wording; avoid book/wallet/offer language so Meta does not reclassify as MARKETING'
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
  template_name = 'workshop_proximity_account_update',
  template_body = E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app for walk-in assistance at this location.\n\nThis is an automated location notification.\n\nThank you.',
  variable_keys = '["customer_name","workshop_name"]'::jsonb,
  template_category = 'UTILITY',
  description = 'Sent when a customer with the app enters a workshop geofence without an active booking (along with app push). UTILITY-safe account-update copy.',
  updated_at = NOW()
WHERE trigger_key = 'workshop_proximity';

UPDATE public.whatsapp_templates SET
  is_active = false,
  updated_at = NOW()
WHERE template_name IN ('workshop_proximity_alert', 'workshop_proximity_nearby');

COMMIT;
