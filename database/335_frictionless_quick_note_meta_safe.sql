-- Frictionless quick note — Meta-safe + blank lines between sections
-- Rule: {{1}} cannot be at start or end.
--
-- Run SQL → Push `myfng_quick_note` → Sync until Meta Approved.

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
  'myfng_quick_note',
  'Quick note · Frictionless',
  'en',
  'UTILITY',
  E'Hello Sir/Mam,\n\n{{1}}\n\nPlease reply to continue with MY FNG.',
  '["message_body"]'::jsonb,
  '["Hello, your car service update is ready."]'::jsonb,
  true,
  jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'purpose', 'Greeting + blank + {{1}} + blank + reply line (Meta start/end safe).',
    'footer', 'MY FNG Support',
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'Hello Sir/Mam,\n\n{{1}}\n\nPlease reply to continue with MY FNG.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array('Hello, your car service update is ready.')
          )
        )
      ),
      jsonb_build_object(
        'type', 'FOOTER',
        'text', 'MY FNG Support'
      )
    ),
    'meta_submit_note',
    'UTILITY. Blank lines between greeting, {{1}}, and reply line.'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  category = 'UTILITY',
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  is_active = true,
  meta = EXCLUDED.meta,
  updated_at = NOW();

UPDATE public.whatsapp_templates
SET
  is_active = true,
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('frictionless', true),
  updated_at = NOW()
WHERE template_name IN ('myfng_closed_window_note', 'myfng_support_note');

UPDATE public.whatsapp_templates
SET
  is_active = false,
  meta = COALESCE(meta, '{}'::jsonb)
    || jsonb_build_object(
      'frictionless', false,
      'meta_note', 'Meta: variables cannot be at start or end of template'
    ),
  updated_at = NOW()
WHERE template_name IN ('myfng_msg_note', 'myfng_msg_note_safe');
