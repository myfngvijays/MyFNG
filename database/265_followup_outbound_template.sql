-- ============================================
-- Follow-up Bot outbound WhatsApp template (UTILITY)
-- Template: account_session_update
-- Run in the SAME Supabase project as your app (.env NEXT_PUBLIC_SUPABASE_URL)
-- ============================================

BEGIN;

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
) VALUES (
  'account_session_update',
  'Follow-up Bot — Account Session Update',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update: your recent MyFNG app session ended before an action was completed.\n\nIf you need assistance with your account or booking, reply to this message.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name"]'::jsonb,
  '["Rahul"]'::jsonb,
  true,
  '{"purpose":"followup_bot_outbound","source":"local_draft","meta_submit_note":"UTILITY — follow-up bot cold outbound. Variable: customer first name."}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  is_active = true,
  meta = '{"purpose":"followup_bot_outbound","source":"local_draft","meta_submit_note":"UTILITY — follow-up bot cold outbound. Variable: customer first name."}'::jsonb,
  updated_at = NOW();

UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'account_session_update',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'FOLLOWUP';

COMMIT;

-- Verify (should return 1 row):
-- SELECT template_name, display_name, is_active, meta->>'source' AS source, updated_at
-- FROM public.whatsapp_templates
-- WHERE template_name = 'account_session_update';
