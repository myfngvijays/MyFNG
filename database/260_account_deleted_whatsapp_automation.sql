-- Account deletion goodbye WhatsApp automation trigger (warm farewell, UTILITY-safe for Meta)

BEGIN;

INSERT INTO public.whatsapp_automation_settings (
  trigger_key,
  display_name,
  description,
  template_name,
  template_body,
  variable_keys,
  is_enabled,
  cooldown_hours,
  phase
)
VALUES (
  'account_deleted',
  'Account Deleted — Goodbye',
  'Warm farewell when a customer permanently deletes their MyFNG account.',
  'account_delete_goodbye',
  E'Hi {{1}},\n\nWe''re truly sad to see you go.\n\nThank you for being part of MyFNG.\n\nTake care,\nTeam MyFNG',
  '["customer_name"]'::jsonb,
  false,
  0,
  '2'
)
ON CONFLICT (trigger_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  template_name = EXCLUDED.template_name,
  template_body = EXCLUDED.template_body,
  variable_keys = EXCLUDED.variable_keys,
  phase = EXCLUDED.phase,
  updated_at = NOW();

COMMIT;
