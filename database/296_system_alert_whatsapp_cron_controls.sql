-- Per-job cron on/off + editable SYSTEM_ALERT WhatsApp numbers (with per-number enabled)

INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value,
  is_editable
) VALUES
(
  'system_alert_whatsapp_numbers',
  '[]',
  'JSON',
  'NOTIFICATIONS',
  'Admin WhatsApp numbers for system health / admin alerts. JSON array of {phone, enabled}. Seeded from SYSTEM_ALERT_WHATSAPP_NUMBERS env when empty.',
  '[]',
  true
),
(
  'whatsapp_cron_job_enabled',
  '{}',
  'JSON',
  'NOTIFICATIONS',
  'Per WhatsApp Cron job id on/off map (e.g. booking-incomplete, system-health-morning). Missing keys default to true.',
  '{}',
  true
)
ON CONFLICT (setting_key) DO NOTHING;

-- App uninstall probe is cron-eligible
UPDATE public.whatsapp_automation_settings
SET cron_enabled = true
WHERE trigger_key = 'app_uninstalled';
