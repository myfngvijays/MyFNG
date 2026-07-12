-- App uninstall goodbye WhatsApp automation trigger (UTILITY-safe for Meta)

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
  'app_uninstalled',
  'App Uninstalled — Goodbye',
  'Warm farewell when the MyFNG app is removed/uninstalled (detected via invalid FCM push token).',
  'app_uninstall_goodbye',
  E'Hi {{1}},\n\nWe''re truly sad to see you go.\n\nThank you for being part of MyFNG.\n\nTake care,\nTeam MyFNG',
  '["customer_name"]'::jsonb,
  false,
  168,
  '2'
)
ON CONFLICT (trigger_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  template_name = EXCLUDED.template_name,
  template_body = EXCLUDED.template_body,
  variable_keys = EXCLUDED.variable_keys,
  cooldown_hours = EXCLUDED.cooldown_hours,
  phase = EXCLUDED.phase,
  updated_at = NOW();

COMMIT;
