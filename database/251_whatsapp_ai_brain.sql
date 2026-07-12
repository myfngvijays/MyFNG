-- WhatsApp AI Brain default config (Phase 1: MISA-powered inbound auto-reply)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES (
  'whatsapp_ai_brain_config',
  '{"enabled":false,"mode":"AI_FIRST","model":"gpt-4o","active_flow_id":null,"system_prompt_addon":"You are replying on WhatsApp. Keep replies concise (under 900 characters when possible). Use short paragraphs.","fallback_message":"Thanks for reaching out to MyFNG! Our team will get back to you shortly. For urgent help, call 9152307030.","skip_assigned_chats":true,"tools":{"pricing":true,"workshops":true,"service_details":true,"booking":true}}',
  'JSON',
  'whatsapp',
  'WhatsApp AI Brain configuration for inbound auto-replies',
  '{"enabled":false,"mode":"AI_FIRST","model":"gpt-4o","active_flow_id":null,"system_prompt_addon":"You are replying on WhatsApp. Keep replies concise (under 900 characters when possible). Use short paragraphs.","fallback_message":"Thanks for reaching out to MyFNG! Our team will get back to you shortly. For urgent help, call 9152307030.","skip_assigned_chats":true,"tools":{"pricing":true,"workshops":true,"service_details":true,"booking":true}}',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
