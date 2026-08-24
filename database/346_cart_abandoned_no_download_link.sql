-- Cart abandoned: remove app-download URL variable.
-- Users already have the app (cart/booking draft activity). Meta cannot edit live templates,
-- so switch automation to new UTILITY template names without Complete booking: {{link}}.
BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta
) VALUES
(
  'cart_booking_saved_account',
  'Cart Abandoned · 5 min',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service"]'::jsonb,
  '["Nikhil","Honda City","Periodic Service"]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_5m', 'source', 'local_draft', 'replaces', 'cart_abandoned_reminder_1')
),
(
  'cart_booking_pending_account',
  'Cart Abandoned · 3 hours',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","offer_line"]'::jsonb,
  '["Nikhil","Honda City","Periodic Service","Your saved booking is still open on your account."]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_3h', 'source', 'local_draft', 'replaces', 'cart_abandoned_reminder_2')
),
(
  'cart_booking_final_account',
  'Cart Abandoned · 12 hours',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  '["customer_name","car","service","urgency_line"]'::jsonb,
  '["Nikhil","Honda City","Periodic Service","Your booking draft is still incomplete on your account."]'::jsonb,
  false,
  jsonb_build_object('purpose', 'cart_abandoned_12h', 'source', 'local_draft', 'replaces', 'cart_abandoned_reminder_3')
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();

UPDATE public.whatsapp_automation_settings SET
  template_name = 'cart_booking_saved_account',
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service"]'::jsonb,
  template_category = 'UTILITY',
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_5m';

UPDATE public.whatsapp_automation_settings SET
  template_name = 'cart_booking_pending_account',
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","offer_line"]'::jsonb,
  template_category = 'UTILITY',
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_3h';

UPDATE public.whatsapp_automation_settings SET
  template_name = 'cart_booking_final_account',
  template_body = E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","urgency_line"]'::jsonb,
  template_category = 'UTILITY',
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_12h';

UPDATE public.whatsapp_templates SET
  is_active = false,
  updated_at = NOW()
WHERE template_name IN (
  'cart_abandoned_reminder_1',
  'cart_abandoned_reminder_2',
  'cart_abandoned_reminder_3'
);

COMMIT;
