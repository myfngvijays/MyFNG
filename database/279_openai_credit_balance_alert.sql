-- OpenAI prepaid credit balance monitoring + low-balance WhatsApp alerts (MISA AI admin)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'openai_credit_baseline_usd',
    '',
    'STRING',
    'MISA_AI',
    'Prepaid credit balance (USD) when last topped up — used to estimate remaining balance',
    '',
    true
  ),
  (
    'openai_credit_baseline_at',
    '',
    'STRING',
    'MISA_AI',
    'ISO timestamp when openai_credit_baseline_usd was last set',
    '',
    true
  ),
  (
    'openai_credit_alert_threshold_usd',
    '5',
    'STRING',
    'MISA_AI',
    'WhatsApp alert when estimated remaining OpenAI credit falls to this USD amount or below',
    '5',
    true
  ),
  (
    'openai_credit_alert_enabled',
    'true',
    'BOOLEAN',
    'MISA_AI',
    'Send WhatsApp alerts to SYSTEM_ALERT_WHATSAPP_NUMBERS when OpenAI balance is low',
    'true',
    true
  ),
  (
    'openai_credit_alert_last_sent_at',
    '',
    'STRING',
    'MISA_AI',
    'Last time a low-balance WhatsApp alert was sent (clears when balance recovers or baseline is updated)',
    '',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
