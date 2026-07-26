-- Booking updated WhatsApp automation (service / package change on lead)

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
  'booking_updated',
  'Booking Updated',
  'Sent when a telecaller updates a lead service/package (e.g. Basic → General Service).',
  'booking_updated',
  E'Hi {{1}},\n\nYour MyFNG service booking has been updated.\n\nBooking ID: {{2}}\nCar: {{3}}\nUpdated service: {{4}}\nPickup: {{5}}\n\nIf you have any questions, reply to this message.',
  '["customer_name","booking_id","car","service","pickup_datetime"]'::jsonb,
  false,
  0,
  '1'
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
