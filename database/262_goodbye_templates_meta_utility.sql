-- Meta rejects goodbye templates with re-engagement lines ("come back", "service again") as MARKETING.
-- Use UTILITY-safe copy + new Meta template names.

BEGIN;

UPDATE public.whatsapp_automation_settings
SET
  template_name = 'account_delete_goodbye',
  template_body = E'Hi {{1}},\n\nWe''re truly sad to see you go.\n\nThank you for being part of MyFNG.\n\nTake care,\nTeam MyFNG',
  variable_keys = '["customer_name"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'account_deleted';

UPDATE public.whatsapp_automation_settings
SET
  template_name = 'app_uninstall_goodbye',
  template_body = E'Hi {{1}},\n\nWe''re truly sad to see you go.\n\nThank you for being part of MyFNG.\n\nTake care,\nTeam MyFNG',
  variable_keys = '["customer_name"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'app_uninstalled';

COMMIT;
