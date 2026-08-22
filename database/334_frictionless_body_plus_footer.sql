-- Frictionless clean layout (Meta-safe)
-- Meta rejects BODY that only has {{1}} ("only have parameters") — even with FOOTER.
-- So: typed message FIRST, one short line after, FOOTER = gray reply hint.
--
-- Customer sees:
--   <your typed text>
--   Thank you.
--   Reply to continue · MY FNG   ← WhatsApp FOOTER (small)
--
-- Run SQL → Push `myfng_msg_note`

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
  'myfng_msg_note',
  'Message · Frictionless',
  'en',
  'UTILITY',
  E'{{1}}\nThank you.',
  '["message_body"]'::jsonb,
  '["Hello, your car service update is ready."]'::jsonb,
  true,
  jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'purpose', 'Typed msg first + short Thank you + FOOTER',
    'replaces', 'myfng_support_note',
    'footer', 'Reply to continue · MY FNG',
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'{{1}}\nThank you.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array('Hello, your car service update is ready.')
          )
        )
      ),
      jsonb_build_object(
        'type', 'FOOTER',
        'text', 'Reply to continue · MY FNG'
      )
    ),
    'meta_submit_note',
    'UTILITY. Body has static "Thank you." so Meta accepts. No long Account update header.'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  is_active = true,
  meta = EXCLUDED.meta,
  updated_at = NOW();

-- Keep safe variant (tiny "Note:" prefix) if above still rejected
UPDATE public.whatsapp_templates
SET
  body_text = E'Note:\n{{1}}\nThank you.',
  example_values = '["Hello, your car service update is ready."]'::jsonb,
  is_active = true,
  meta = jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'footer', 'Reply to continue · MY FNG',
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'Note:\n{{1}}\nThank you.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array('Hello, your car service update is ready.')
          )
        )
      ),
      jsonb_build_object(
        'type', 'FOOTER',
        'text', 'Reply to continue · MY FNG'
      )
    )
  ),
  updated_at = NOW()
WHERE template_name = 'myfng_msg_note_safe';

UPDATE public.whatsapp_templates
SET
  meta = COALESCE(meta, '{}'::jsonb)
    || jsonb_build_object('frictionless', false, 'superseded_by', 'myfng_msg_note'),
  updated_at = NOW()
WHERE template_name IN (
  'myfng_support_note',
  'myfng_closed_window_note',
  'myfng_frictionless_chat'
);
