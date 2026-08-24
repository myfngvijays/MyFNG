-- Workshop proximity: app-already-installed copy (no download URL variable).
-- New Meta template name required — existing workshop_proximity_alert stays on Meta with 3 vars.
BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta
) VALUES (
  'workshop_proximity_nearby',
  'Workshop Proximity',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nYou are near {{2}}.\n\nOpen the MyFNG app and book your service to get wallet benefits and live tracking.\n\nThank you.',
  '["customer_name","workshop_name"]'::jsonb,
  '["Nikhil","MyFNG Thane Vartak Nagar"]'::jsonb,
  false,
  jsonb_build_object('purpose', 'workshop_proximity', 'source', 'local_draft', 'replaces', 'workshop_proximity_alert')
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
  template_name = 'workshop_proximity_nearby',
  template_body = E'Hi {{1}},\n\nYou are near {{2}}.\n\nOpen the MyFNG app and book your service to get wallet benefits and live tracking.\n\nThank you.',
  variable_keys = '["customer_name","workshop_name"]'::jsonb,
  description = 'Sent when a customer with the app enters a workshop geofence without an active booking (along with app push).',
  updated_at = NOW()
WHERE trigger_key = 'workshop_proximity';

-- Old link-based template no longer used by automation
UPDATE public.whatsapp_templates SET
  is_active = false,
  updated_at = NOW()
WHERE template_name = 'workshop_proximity_alert';

COMMIT;
