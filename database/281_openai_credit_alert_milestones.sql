-- Track which OpenAI balance milestone alerts ($5/$4/$3/$2/$1) were already sent
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'openai_credit_alert_milestones_usd',
    '5,4,3,2,1',
    'STRING',
    'MISA_AI',
    'Comma-separated USD milestones for OpenAI low-balance WhatsApp alerts',
    '5,4,3,2,1',
    true
  ),
  (
    'openai_credit_alert_milestones_sent',
    '',
    'STRING',
    'MISA_AI',
    'Comma-separated milestone USD values already alerted in current low-balance cycle',
    '',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;

-- Keep threshold aligned with highest milestone for backward compatibility
UPDATE public.system_settings
SET setting_value = '5',
    description = 'Highest OpenAI balance alert milestone in USD (alerts also fire at 4, 3, 2, 1)'
WHERE setting_key = 'openai_credit_alert_threshold_usd';
