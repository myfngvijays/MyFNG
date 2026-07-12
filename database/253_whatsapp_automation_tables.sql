-- ============================================
-- WhatsApp automation (Phase 1 foundation)
-- Step 2: settings + trigger logs for cooldown / audit
-- All templates: UTILITY, English (en)
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_settings (
  trigger_key VARCHAR(80) PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  description TEXT,
  template_name VARCHAR(150) NOT NULL,
  template_language VARCHAR(20) NOT NULL DEFAULT 'en',
  template_category VARCHAR(30) NOT NULL DEFAULT 'UTILITY',
  template_body TEXT NOT NULL,
  variable_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  phase VARCHAR(10) NOT NULL DEFAULT '1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_automation_settings IS
  'Per-trigger WhatsApp automation config (template, cooldown, on/off). UTILITY + en only.';

CREATE TABLE IF NOT EXISTS public.whatsapp_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key VARCHAR(80) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  template_name VARCHAR(150),
  provider_message_id VARCHAR(255),
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'SENT', -- SENT | FAILED | SKIPPED
  skip_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_trigger_logs IS
  'Audit + cooldown log for outbound WhatsApp automation sends.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_trigger_logs_phone_trigger_sent
  ON public.whatsapp_trigger_logs (phone, trigger_key, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_trigger_logs_customer_trigger_sent
  ON public.whatsapp_trigger_logs (customer_id, trigger_key, sent_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_trigger_logs_sent_at
  ON public.whatsapp_trigger_logs (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_settings_enabled
  ON public.whatsapp_automation_settings (is_enabled)
  WHERE is_enabled = true;

ALTER TABLE public.whatsapp_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_trigger_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_automation_settings_service_role ON public.whatsapp_automation_settings;
CREATE POLICY whatsapp_automation_settings_service_role
  ON public.whatsapp_automation_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_trigger_logs_service_role ON public.whatsapp_trigger_logs;
CREATE POLICY whatsapp_trigger_logs_service_role
  ON public.whatsapp_trigger_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed triggers (disabled by default until templates are approved on Meta)
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
) VALUES
  (
    'booking_confirmed',
    'Booking Confirmed',
    'Sent immediately after a service booking is created.',
    'booking_confirmed',
    E'Hi {{1}},\n\nYour MyFNG service booking is confirmed.\n\nBooking ID: {{2}}\nCar: {{3}}\nService: {{4}}\nPickup: {{5}}\n\nOur team will contact you shortly with pickup details.',
    '["customer_name","booking_id","car","service","pickup_datetime"]'::jsonb,
    false,
    0,
    '1'
  ),
  (
    'booking_incomplete',
    'Booking Incomplete',
    'Sent when a logged-in user abandons an in-progress booking.',
    'booking_incomplete',
    E'Hi {{1}},\n\nYour MyFNG service booking is incomplete.\n\nCar: {{2}}\nService: {{3}}\n\nPlease complete your booking to confirm your slot.',
    '["customer_name","car","service"]'::jsonb,
    false,
    24,
    '1'
  ),
  (
    'membership_payment_success',
    'Membership Payment Success',
    'Sent after Prime / membership payment succeeds.',
    'membership_payment_success',
    E'Hi {{1}},\n\nYour payment of INR {{2}} has been received successfully.\n\nPlan: {{3}}\nTransaction ID: {{4}}\n\nYour Prime membership is now active.',
    '["customer_name","amount","plan_name","transaction_id"]'::jsonb,
    false,
    0,
    '1'
  ),
  (
    'membership_payment_failed',
    'Membership Payment Failed',
    'Sent when membership payment fails or is cancelled.',
    'membership_payment_failed',
    E'Hi {{1}},\n\nYour membership payment of INR {{2}} could not be processed.\n\nPlan: {{3}}\n\nPlease retry from the MyFNG app to activate your Prime membership.',
    '["customer_name","amount","plan_name"]'::jsonb,
    false,
    6,
    '1'
  ),
  (
    'app_session_incomplete',
    'App Session Incomplete',
    'Sent when a logged-in user opens the app and closes within ~10 seconds.',
    'app_session_incomplete',
    E'Hi {{1}},\n\nYou recently opened the MyFNG app but did not complete an action.\n\nIf you need help booking a service, open the app or reply to this message.',
    '["customer_name"]'::jsonb,
    false,
    24,
    '2'
  ),
  (
    'admin_daily_summary',
    'Admin Daily Summary',
    'Daily internal summary to admin WhatsApp numbers.',
    'admin_daily_summary',
    E'MyFNG Daily Summary for {{1}}\n\nBookings: {{2}}\nMembership payments: {{3}}\nRevenue INR: {{4}}\nPending pickups: {{5}}\nFailed payments: {{6}}\n\nThank you.',
    '["date","bookings_count","membership_count","revenue","pending_pickups","failed_payments"]'::jsonb,
    false,
    0,
    '2'
  ),
  (
    'service_due_reminder',
    'Service Due Reminder',
    'Utility reminder when periodic service is due for a saved vehicle.',
    'service_due_reminder',
    E'Hi {{1}},\n\nPeriodic service is due for your {{2}} ({{3}}).\n\nLast service: {{4}}\n\nBook your next service on MyFNG to keep your car in good condition.',
    '["customer_name","car_model","reg_number","last_service_date"]'::jsonb,
    false,
    720,
    '3'
  ),
  (
    'membership_expiring',
    'Membership Expiring',
    'Utility reminder before Prime membership expiry.',
    'membership_expiring',
    E'Hi {{1}},\n\nYour MyFNG Prime membership expires on {{2}}.\n\nRenew from the app to continue your membership benefits.',
    '["customer_name","expiry_date"]'::jsonb,
    false,
    168,
    '3'
  )
ON CONFLICT (trigger_key) DO NOTHING;

COMMIT;
