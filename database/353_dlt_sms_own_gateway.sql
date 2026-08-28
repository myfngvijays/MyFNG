-- Own operator SMS pipe (no MSG91 / Fast2SMS / Twilio).
-- Safe to re-run after 352_dlt_sms.sql.

ALTER TABLE public.dlt_sms_telemarketers
  DROP CONSTRAINT IF EXISTS dlt_sms_telemarketers_provider_check;

UPDATE public.dlt_sms_telemarketers
SET provider = 'MYFNG'
WHERE provider IN ('MSG91', 'FAST2SMS', 'TWILIO', 'CUSTOM');

ALTER TABLE public.dlt_sms_telemarketers
  ALTER COLUMN provider SET DEFAULT 'MYFNG';

ALTER TABLE public.dlt_sms_telemarketers
  ADD CONSTRAINT dlt_sms_telemarketers_provider_check
  CHECK (provider IN ('MYFNG', 'JIO', 'AIRTEL', 'VIL', 'BSNL', 'SMPP', 'HTTP'));
