-- Frictionless quick note + "OK" quick-reply button.
-- Same body as myfng_quick_note. Tapping OK sends a reply, which opens the 24h window
-- so telecallers can send free text / images afterwards.
-- Rule: {{1}} cannot be at start or end.
--
-- Run SQL → Super Admin → WhatsApp Templates → Push `quick_note_with_button` → Sync until Meta Approved.
-- Templates live on the WABA: one push covers every number (6161, 0505) on that WABA.

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
  'quick_note_with_button',
  'Quick note · Frictionless · OK button',
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
    'purpose', 'Quick note with an OK quick-reply button; one tap opens the 24h window.',
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
      ),
      jsonb_build_object(
        'type', 'BUTTONS',
        'buttons', jsonb_build_array(
          jsonb_build_object('type', 'QUICK_REPLY', 'text', 'OK')
        )
      )
    ),
    'meta_submit_note',
    'UTILITY. Blank lines between greeting, {{1}}, and reply line. Quick reply button: OK.'
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
  meta = COALESCE(public.whatsapp_templates.meta, '{}'::jsonb) || EXCLUDED.meta,
  updated_at = NOW();
