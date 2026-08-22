-- Clean frictionless note — Meta needs enough static text vs {{1}}
-- Error if too short: "too many variables for its length"
-- Keep short footer (not the long Account update / Please reply… clutter)
--
-- Push `myfng_support_note` after running this SQL.

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
  'myfng_support_note',
  'Support note · Frictionless',
  'en',
  'UTILITY',
  E'Update from MY FNG support:\n{{1}}\nReply to continue.',
  '["message_body"]'::jsonb,
  '["Hello, your car service update is ready."]'::jsonb,
  true,
  jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'purpose', 'Closed window free-text — short header/footer, Meta length-safe',
    'replaces', 'myfng_closed_window_note',
    'cta', null,
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'Update from MY FNG support:\n{{1}}\nReply to continue.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array(
              'Hello, your car service update is ready.'
            )
          )
        )
      )
    ),
    'meta_submit_note',
    'UTILITY. Enough static text for Meta ratio rule. Short lines only.'
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

UPDATE public.whatsapp_templates
SET
  meta = COALESCE(meta, '{}'::jsonb)
    || jsonb_build_object(
      'frictionless', false,
      'superseded_by', 'myfng_support_note'
    ),
  updated_at = NOW()
WHERE template_name IN ('myfng_closed_window_note', 'myfng_frictionless_chat');
