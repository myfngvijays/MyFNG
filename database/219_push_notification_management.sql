-- 219_push_notification_management.sql
-- Push notification templates for Super Admin console + indexes for history queries.

CREATE TABLE IF NOT EXISTS public.push_notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'CUSTOMER',
  priority TEXT NOT NULL DEFAULT 'default' CHECK (priority IN ('default', 'high')),
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_notification_templates_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_push_notification_templates_active_sort
  ON public.push_notification_templates(is_active, sort_order ASC);

ALTER TABLE public.push_notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_templates_admin_select" ON public.push_notification_templates;
CREATE POLICY "push_templates_admin_select"
  ON public.push_notification_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

GRANT SELECT ON public.push_notification_templates TO authenticated;

INSERT INTO public.push_notification_templates
  (name, title, body, target_role, priority, category, description, sort_order)
VALUES
  (
    'Welcome Bonus',
    '₹1000 Welcome Bonus Credited!',
    'Your welcome bonus is in your MyFNG wallet. Book your first service today and save more.',
    'CUSTOMER',
    'high',
    'onboarding',
    'New customer welcome push',
    10
  ),
  (
    'Diwali Service Sale',
    'Diwali Mega Service Sale 🪔',
    'Flat 20% off on periodic service + free pickup & drop. Book before slots fill up!',
    'CUSTOMER',
    'default',
    'promotion',
    'Seasonal festival campaign',
    20
  ),
  (
    'Service Due Reminder',
    'Time for Your Car Service',
    'Your car service is due soon. Schedule pickup in 2 taps — same-day slots available.',
    'CUSTOMER',
    'default',
    'reminder',
    'Periodic service reminder',
    30
  ),
  (
    'Pickup Scheduled',
    'Pickup Scheduled ✅',
    'Our driver is assigned for your vehicle pickup. Track live status in the app.',
    'CUSTOMER',
    'high',
    'transactional',
    'Booking pickup confirmation',
    40
  ),
  (
    'Payment Pending',
    'Complete Your Payment',
    'Your service invoice is ready. Pay now to avoid delay in delivery.',
    'CUSTOMER',
    'high',
    'transactional',
    'Invoice payment nudge',
    50
  ),
  (
    'App Update',
    'Update MyFNG App',
    'A new version with faster booking & push alerts is available. Update now for the best experience.',
    'CUSTOMER',
    'default',
    'system',
    'Force-update / upgrade nudge',
    60
  ),
  (
    'Workshop SLA Alert',
    'SLA Breach Alert',
    'A job in your workshop is nearing SLA breach. Please review pending tasks immediately.',
    'WORKSHOP_ADMIN',
    'high',
    'operations',
    'Staff workshop alert',
    70
  ),
  (
    'Staff Daily Brief',
    'Good Morning Team',
    'Check today''s assigned leads, pickups, and pending follow-ups in your dashboard.',
    'ALL',
    'default',
    'operations',
    'Morning staff broadcast',
    80
  )
ON CONFLICT (name) DO NOTHING;

-- Extra setting for default Android notification channel (display only in admin UI)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('fcm_android_default_channel', 'default', 'STRING', 'NOTIFICATIONS', 'Android FCM default notification channel id', 'default', true),
  ('fcm_apns_environment', 'production', 'STRING', 'NOTIFICATIONS', 'APNs environment for iOS push (production/development)', 'production', false)
ON CONFLICT (setting_key) DO NOTHING;
