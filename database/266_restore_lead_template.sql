-- ============================================
-- Re-seed Chase lead template (restores after Sync deleted it)
-- Run in Supabase SQL Editor, then refresh WhatsApp Templates page
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
  'lead_enquiry_account_update',
  'Chase Bot — Lead Enquiry Account Update',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update: we received your car service enquiry on your MyFNG account.\n\nIf you need assistance with your enquiry or booking, reply to this message.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name"]'::jsonb,
  '["Rahul"]'::jsonb,
  true,
  '{"purpose":"chase_bot_outbound","source":"local_draft","meta_submit_note":"Chase Bot cold outbound. Protected from Sync delete."}'::jsonb,
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
  meta = '{"purpose":"chase_bot_outbound","source":"local_draft","meta_submit_note":"Chase Bot cold outbound. Protected from Sync delete."}'::jsonb,
  updated_at = NOW();

UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'lead_enquiry_account_update',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'CHASE';

-- Follow-up Bot: Meta pe actual naam app_session_incomplete hai (account_session_update nahi)
UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'app_session_incomplete',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'FOLLOWUP';

COMMIT;

-- Verify:
-- SELECT template_name, is_active, meta->>'source', meta->>'purpose'
-- FROM whatsapp_templates
-- WHERE template_name IN ('lead_enquiry_account_update', 'app_session_incomplete');
