-- Brain high-priority settings: 24h window template fallback
UPDATE public.system_settings
SET setting_value = (
  COALESCE(NULLIF(setting_value, ''), '{}')::jsonb
  || jsonb_build_object(
    'session_window_hours', 24,
    'reopen_template_name', null,
    'reopen_template_language', 'en',
    'reopen_template_params', '[]'::jsonb
  )
)::text,
updated_at = NOW()
WHERE setting_key = 'whatsapp_ai_brain_config';
