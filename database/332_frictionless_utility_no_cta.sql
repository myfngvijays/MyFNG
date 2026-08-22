-- Frictionless free-text — Utility-safe (NO button, NO website CTA)
-- Meta reclassified `myfng_frictionless_chat` as MARKETING because of URL button
-- + "tap Chat with us" wording. Use a NEW name; do not reuse the marketing template.
--
-- After migrate:
-- 1) Run SQL
-- 2) Super Admin → WhatsApp Templates → Push `myfng_closed_window_note`
-- 3) Meta me category UTILITY + APPROVED confirm karo (Marketing dikhe toh Edit / appeal)

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
  'myfng_closed_window_note',
  'Closed window · Support note',
  'en',
  'UTILITY',
  -- Pure account/support update tone (Meta UTILITY-friendly). Agent free text = {{1}}.
  E'Account update from MY FNG:\n{{1}}\nPlease reply to this message if you need further assistance with your service request.',
  '["message_body"]'::jsonb,
  '["Your service request is being reviewed by our team."]'::jsonb,
  true,
  jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'purpose', 'Closed 24h window free-text support note — no CTA button',
    'replaces', 'myfng_frictionless_chat',
    'cta', null,
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'Account update from MY FNG:\n{{1}}\nPlease reply to this message if you need further assistance with your service request.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array(
              'Your service request is being reviewed by our team.'
            )
          )
        )
      )
    ),
    'meta_submit_note',
    'UTILITY only. No BUTTONS. Avoid marketing / tap-to-chat / website CTA wording so Meta does not reclassify.'
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
  meta = EXCLUDED.meta,
  updated_at = NOW();

-- Optional: pause the Marketing-reclassified template in our DB (keep on Meta for history)
UPDATE public.whatsapp_templates
SET
  is_active = false,
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
    'superseded_by', 'myfng_closed_window_note',
    'meta_note', 'Meta reclassified as MARKETING — do not use for closed-window frictionless'
  ),
  updated_at = NOW()
WHERE template_name = 'myfng_frictionless_chat';
