-- App Settings Menu Configuration
-- Controls visibility of menu items on the mobile app Settings/Profile screen

CREATE TABLE IF NOT EXISTS public.app_settings_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'settings',
  section TEXT NOT NULL DEFAULT 'main',
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  requires_login BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.app_settings_menu
  FOR SELECT USING (true);

CREATE POLICY "Admin write access" ON public.app_settings_menu
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
    )
  );

INSERT INTO public.app_settings_menu (menu_id, label, icon, section, enabled, display_order, requires_login) VALUES
  ('profile',       'My Profile',       'person',            'main',  true, 1, true),
  ('addresses',     'Your Addresses',   'location',          'main',  true, 2, true),
  ('membership',    'Membership',       'trophy',            'main',  true, 3, false),
  ('wallet',        'Your Wallet',      'wallet',            'main',  true, 4, true),
  ('orders',        'Order History',    'receipt',           'main',  true, 5, true),
  ('cart',          'Cart',             'cart',              'main',  true, 6, false),
  ('coupons',       'My Coupons',       'pricetag',          'main',  true, 7, true),
  ('referral',      'Refer & Earn',     'gift',              'main',  true, 8, true),
  ('notifications', 'Notifications',    'notifications',     'main',  true, 9, false),
  ('privacy',       'Privacy Policy',   'shield-checkmark',  'legal', true, 1, false),
  ('terms',         'Terms of Use',     'document-text',     'legal', true, 2, false),
  ('support',       'Help & Support',   'help-circle',       'legal', true, 3, false),
  ('delete',        'Delete Account',   'trash',             'legal', true, 4, true)
ON CONFLICT (menu_id) DO NOTHING;
