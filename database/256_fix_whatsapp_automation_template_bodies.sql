-- Fix WhatsApp automation template bodies for Meta approval rules.
-- Meta rejects templates whose body starts or ends with a variable ({{n}}).

BEGIN;

UPDATE public.whatsapp_automation_settings
SET
  template_body = E'MyFNG Daily Summary for {{1}}\n\nBookings: {{2}}\nMembership payments: {{3}}\nRevenue INR: {{4}}\nPending pickups: {{5}}\nFailed payments: {{6}}\n\nThank you.',
  updated_at = NOW()
WHERE trigger_key = 'admin_daily_summary';

COMMIT;
