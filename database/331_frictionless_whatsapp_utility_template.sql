-- Frictionless / closed-window Utility template (NO URL button)
-- Body = static wrapper + free text {{1}} only. Customer replies to reopen window.
--
-- After migrate:
-- 1) Run this SQL
-- 2) Super Admin → WhatsApp Templates → Push `myfng_frictionless_chat`
--    (agar pehle wali version Meta pe PENDING/APPROVED hai, naya naam chahiye ho sakta hai
--     ya Meta pe purani delete/reject ke baad same name push)
-- 3) Wait Meta APPROVED

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
  'myfng_frictionless_chat',
  'Frictionless · Free text',
  'en',
  'UTILITY',
  E'MY FNG support message:\n{{1}}\nPlease reply to this message to continue chatting with us.',
  '["message_body"]'::jsonb,
  '["Hi, car service ke liye help chahiye toh yahan bataiye."]'::jsonb,
  true,
  jsonb_build_object(
    'frictionless', true,
    'opens_session', true,
    'crm_telecaller', true,
    'purpose', 'Closed 24h window — type any message, no CTA/URL button',
    'cta', null,
    'meta_components', jsonb_build_array(
      jsonb_build_object(
        'type', 'BODY',
        'text', E'MY FNG support message:\n{{1}}\nPlease reply to this message to continue chatting with us.',
        'example', jsonb_build_object(
          'body_text', jsonb_build_array(
            jsonb_build_array(
              'Hi, car service ke liye help chahiye toh yahan bataiye.'
            )
          )
        )
      )
    ),
    'meta_submit_note',
    'UTILITY frictionless: static wrapper + {{1}} only. No buttons / no website link.'
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
