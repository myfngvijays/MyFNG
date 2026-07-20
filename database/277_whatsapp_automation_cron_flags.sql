-- Per-trigger cron on/off for WhatsApp automation scheduled jobs
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS cron_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_automation_settings.cron_enabled IS
  'When true, the scheduled cron job may send this trigger (still requires is_enabled).';

-- Cron-eligible triggers default ON for cron (instant triggers stay cron_enabled = false)
UPDATE public.whatsapp_automation_settings
SET cron_enabled = true
WHERE trigger_key IN (
  'booking_incomplete',
  'admin_daily_summary',
  'service_due_reminder',
  'membership_expiring'
);

INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value
) VALUES (
  'whatsapp_automation_cron_master_enabled',
  'true',
  'BOOLEAN',
  'NOTIFICATIONS',
  'Master switch for WhatsApp automation cron scheduler (/api/cron/whatsapp-automation).',
  'true'
)
ON CONFLICT (setting_key) DO NOTHING;
