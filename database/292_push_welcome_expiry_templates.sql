-- Welcome bonus expiry push templates (editable in Super Admin → Push → Templates)
-- Placeholders: {{amount}} {{days_left}}
-- Cron names are stable — do not rename these rows.

INSERT INTO public.push_notification_templates
  (name, title, body, target_role, priority, category, description, sort_order, is_active)
VALUES
  (
    'Welcome Bonus Expiry D15',
    '₹{{amount}} Welcome Bonus — 15 days left',
    'Your MyFNG welcome bonus expires in 15 days. Book a service and use it before it expires.',
    'CUSTOMER',
    'high',
    'automation',
    'Auto cron: once when welcome bonus has 15 days left. Placeholders: {{amount}} {{days_left}}',
    100,
    true
  ),
  (
    'Welcome Bonus Expiry Daily',
    '₹{{amount}} Welcome Bonus — {{days_left}} days left',
    'Hurry! Your welcome bonus expires in {{days_left}} days. Book now and save.',
    'CUSTOMER',
    'high',
    'automation',
    'Auto cron: daily when 7–2 days left. Placeholders: {{amount}} {{days_left}}',
    101,
    true
  ),
  (
    'Welcome Bonus Expiry Tomorrow',
    'Tomorrow! ₹{{amount}} Welcome Bonus expires',
    'Your welcome bonus expires tomorrow. Use it on your next booking today.',
    'CUSTOMER',
    'high',
    'automation',
    'Auto cron: when 1 day left. Placeholders: {{amount}} {{days_left}}',
    102,
    true
  ),
  (
    'Welcome Bonus Expiry Today',
    'Expires today! ₹{{amount}} Welcome Bonus',
    'Your welcome bonus expires today. Book now and use it before midnight.',
    'CUSTOMER',
    'high',
    'automation',
    'Auto cron: on expiry day. Placeholders: {{amount}} {{days_left}}',
    103,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
