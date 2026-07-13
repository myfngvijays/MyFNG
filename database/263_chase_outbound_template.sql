-- ============================================
-- Chase Bot outbound WhatsApp template (UTILITY)
-- Uses UTILITY-safe copy (same pattern as account_session_update).
-- Old name lead_enquiry_followup was rejected by Meta — use lead_enquiry_account_update.
-- Set in Chase Bot config:
--   outbound_template_name = lead_enquiry_account_update
--   outbound_template_language = en
-- ============================================

BEGIN;

-- Deactivate rejected legacy template if present
UPDATE public.whatsapp_templates
SET
  is_active = false,
  meta = COALESCE(meta, '{}'::jsonb) || '{"deprecated":true,"replaced_by":"lead_enquiry_account_update"}'::jsonb,
  updated_at = NOW()
WHERE template_name = 'lead_enquiry_followup';

INSERT INTO public.whatsapp_templates (
  template_name,
  display_name,
  language_code,
  category,
  body_text,
  variable_keys,
  example_values,
  is_active,
  meta
) VALUES (
  'lead_enquiry_account_update',
  'Chase Bot — Lead Enquiry Account Update',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update: we received your car service enquiry on your MyFNG account.\n\nIf you need assistance with your enquiry or booking, reply to this message.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name"]'::jsonb,
  '["Rahul"]'::jsonb,
  true,
  '{"purpose":"chase_bot_outbound","source":"local_draft","meta_submit_note":"UTILITY — mirrors approved account_session_update pattern. Single variable: customer first name."}'::jsonb
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Pre-fill Chase Bot config for existing installs
UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'lead_enquiry_account_update',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'CHASE';

COMMIT;
