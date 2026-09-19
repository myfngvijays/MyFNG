INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'google_ads_funds_alert_threshold',
    '1000',
    'STRING',
    'GOOGLE_ADS',
    'WhatsApp alert when Google Ads remaining account budget falls to this INR amount or below',
    '1000',
    true
  ),
  (
    'google_ads_funds_alert_enabled',
    'true',
    'BOOLEAN',
    'GOOGLE_ADS',
    'Send WhatsApp to SYSTEM_ALERT numbers when Google Ads funds are below threshold',
    'true',
    true
  ),
  (
    'google_ads_funds_alert_last_sent_at',
    '',
    'STRING',
    'GOOGLE_ADS',
    'Last low-funds WhatsApp (clears when remaining recovers above threshold + 500)',
    '',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
