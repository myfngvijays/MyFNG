-- Remove app download links from cart / proximity WhatsApp templates (open app manually)
BEGIN;

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app to book with wallet benefits, live tracking and warranty.\n\nThis is an automated location notification.\n\nThank you.',
  variable_keys = '["customer_name","workshop_name"]'::jsonb,
  example_values = '["Rahul Sharma","MyFNG Andheri West"]'::jsonb,
  updated_at = NOW()
WHERE template_name = 'workshop_proximity_alert';

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service"]'::jsonb,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_1';

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","offer_line"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service","Use your wallet balance of ₹500 on this booking."]'::jsonb,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_2';

UPDATE public.whatsapp_templates SET
  body_text = E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","urgency_line"]'::jsonb,
  example_values = '["Rahul Sharma","Honda City","Periodic Service","Limited pickup slots today — complete booking to avoid reschedule."]'::jsonb,
  updated_at = NOW()
WHERE template_name = 'cart_abandoned_reminder_3';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nAccount update: you are near {{2}} (MyFNG service center).\n\nOpen the MyFNG app to book with wallet benefits, live tracking and warranty.\n\nThis is an automated location notification.\n\nThank you.',
  variable_keys = '["customer_name","workshop_name"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'workshop_proximity';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is saved in your account.\n\nCar: {{2}}\nService: {{3}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_5m';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nYour MyFNG booking is still pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","offer_line"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_3h';

UPDATE public.whatsapp_automation_settings SET
  template_body = E'Hi {{1}},\n\nReminder: your MyFNG service booking is pending.\n\nCar: {{2}}\nService: {{3}}\n{{4}}\n\nOpen the MyFNG app to complete your booking.\n\nThis is an automated account notification.\n\nThank you.',
  variable_keys = '["customer_name","car","service","urgency_line"]'::jsonb,
  updated_at = NOW()
WHERE trigger_key = 'cart_abandoned_12h';

COMMIT;
