-- Workshop proximity + cart abandonment WhatsApp (5m / 3h / 12h sequence)
BEGIN;

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS abandonment_anchor_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_cart_reminder_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_cart_reminder_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_cart_reminder_3_sent_at TIMESTAMPTZ;

ALTER TABLE public.booking_drafts
  ADD COLUMN IF NOT EXISTS wa_reminder_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_reminder_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_reminder_3_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_carts_abandonment_anchor
  ON public.carts (status, abandonment_anchor_at)
  WHERE status = 'ACTIVE';

-- ── WhatsApp templates (local drafts → push to Meta from admin) ──

INSERT INTO public.whatsapp_templates (
  template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta
) VALUES
(
  'workshop_proximity_alert',
  'Workshop Proximity Alert',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app to book with wallet benefits, live tracking and warranty.\n\nThis is an automated location notification.\n\nThank you.',
  '["customer_name","workshop_name"]'::jsonb,
  '["Rahul Sharma","MyFNG Andheri West"]'::jsonb,
  false,
  jsonb_build_object('purpose', 'workshop_proximity', 'source', 'local_draft')
),
(
  'cart_abandoned_reminder_1',
  'Cart Abandoned · 5 min',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service"]'::jsonb,
  '["Rahul Sharma","Honda City","Periodic Service"]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_5m', 'source', 'local_draft')
),
(
  'cart_abandoned_reminder_2',
  'Cart Abandoned · 3 hours',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","offer_line"]'::jsonb,
  '["Rahul Sharma","Honda City","Periodic Service","Use your wallet balance of ₹500 on this booking."]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_3h', 'source', 'local_draft')
),
(
  'cart_abandoned_reminder_3',
  'Cart Abandoned · 12 hours',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","urgency_line"]'::jsonb,
  '["Rahul Sharma","Honda City","Periodic Service","Limited pickup slots today — complete booking to avoid reschedule."]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_12h', 'source', 'local_draft')
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();

INSERT INTO public.whatsapp_automation_settings (
  trigger_key, display_name, description, template_name, template_body, variable_keys, is_enabled, cooldown_hours, phase
) VALUES
(
  'workshop_proximity',
  'Workshop Proximity',
  'Sent when a customer enters a workshop geofence without an active booking (along with app push).',
  'workshop_proximity_alert',
  E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app to book with wallet benefits, live tracking and warranty.\n\nThis is an automated location notification.\n\nThank you.',
  '["customer_name","workshop_name"]'::jsonb,
  false,
  24,
  '2'
),
(
  'cart_abandoned_5m',
  'Cart Abandoned · 5 min',
  'First reminder ~5 minutes after cart add or booking draft activity without checkout.',
  'cart_abandoned_reminder_1',
  E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service"]'::jsonb,
  false,
  0,
  '2'
),
(
  'cart_abandoned_3h',
  'Cart Abandoned · 3 hours',
  'Second reminder ~3 hours after cart add if booking not completed. Offer line is personalized from wallet/membership.',
  'cart_abandoned_reminder_2',
  E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","offer_line"]'::jsonb,
  false,
  0,
  '2'
),
(
  'cart_abandoned_12h',
  'Cart Abandoned · 12 hours',
  'Final reminder ~12 hours after cart add if booking still not completed.',
  'cart_abandoned_reminder_3',
  E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","urgency_line"]'::jsonb,
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

UPDATE public.whatsapp_automation_settings
SET cron_enabled = true, updated_at = NOW()
WHERE trigger_key IN ('cart_abandoned_5m', 'cart_abandoned_3h', 'cart_abandoned_12h');

COMMIT;
