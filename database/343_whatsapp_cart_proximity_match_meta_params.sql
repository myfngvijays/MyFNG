-- Align local cart/proximity template bodies with LIVE Meta templates.
-- Meta still has the app-link variable ({{n}} = https://myfng.in/go/myfngapp).
-- Local migration 300 removed links, so Send Test sent too few params → Meta #132000.
BEGIN;

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nComplete booking: {{4}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","app_link"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service","https://myfng.in/go/myfngapp"]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_1';

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nComplete booking: {{5}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","offer_line","app_link"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service","Use your wallet balance of ₹500 on this booking.","https://myfng.in/go/myfngapp"]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_2';

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nComplete booking: {{5}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","urgency_line","app_link"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service","Limited pickup slots today — complete booking to avoid reschedule.","https://myfng.in/go/myfngapp"]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_3';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nComplete booking: {{4}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","app_link"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_5m';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nComplete booking: {{5}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","offer_line","app_link"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_3h';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nComplete booking: {{5}}\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","urgency_line","app_link"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_12h';

COMMIT;
