-- OpenAI prepaid balance low alert — WhatsApp UTILITY template (MISA AI admin)
-- Submit to Meta from dashboard: MISA AI → Create Template, or via API createOpenAiBalanceAlertTemplate

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
  'openai_balance_alert',
  'OpenAI Balance Alert',
  'en',
  'UTILITY',
  E'MyFNG OpenAI Balance Alert\n\nTime: {{1}}\nStatus: {{2}}\n\nRemaining credit: ${{3}} USD\nAlert threshold: ${{4}} USD\n\n{{5}}\n\nThis is an automated billing notification for MyFNG administrators.',
  '["timestamp","status","remaining_usd","threshold_usd","details"]'::jsonb,
  '["20/07/2026 4:05 PM","OPENAI BALANCE LOW","4.80","5.00","Please top up at platform.openai.com and update baseline in MISA AI admin."]'::jsonb,
  false,
  '{"purpose":"openai_balance_alert","source":"local_draft","meta_submit_note":"UTILITY — admin billing alert when OpenAI prepaid credit is low."}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();

COMMIT;
