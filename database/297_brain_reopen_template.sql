-- ============================================
-- WhatsApp AI Brain: default 24h window reopen template
-- Uses approved UTILITY template lead_enquiry_account_update (same as Chase Bot cold outbound).
-- Customer reply to template reopens the 24h session for MISA free-text replies.
-- ============================================

BEGIN;

UPDATE public.system_settings
SET
  setting_value = (
    COALESCE(NULLIF(setting_value, ''), '{}')::jsonb
    || jsonb_build_object(
      'session_window_hours', 24,
      'reopen_template_name', 'lead_enquiry_account_update',
      'reopen_template_language', 'en',
      'reopen_template_params', '[]'::jsonb
    )
  )::text,
  updated_at = NOW()
WHERE setting_key = 'whatsapp_ai_brain_config';

-- Ensure Chase / Follow-up outbound templates stay aligned (24h+ cron outbound)
UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'lead_enquiry_account_update',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'CHASE'
  AND COALESCE(triggers_json->>'outbound_template_name', '') = '';

UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'app_session_incomplete',
    'outbound_template_language', 'en'
  ),
  updated_at = NOW()
WHERE agent_type = 'FOLLOWUP'
  AND COALESCE(triggers_json->>'outbound_template_name', '') = '';

COMMIT;

-- Verify:
-- SELECT setting_value::jsonb->>'reopen_template_name' FROM system_settings WHERE setting_key = 'whatsapp_ai_brain_config';
-- SELECT agent_type, triggers_json->>'outbound_template_name' FROM whatsapp_agent_configs;
