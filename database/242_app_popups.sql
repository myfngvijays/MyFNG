-- Dynamic app popups managed from admin panel
CREATE TABLE IF NOT EXISTS public.app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT 'gift',
  image_url TEXT,
  primary_button_text TEXT DEFAULT 'OK',
  primary_button_action TEXT DEFAULT 'DISMISS',
  secondary_button_text TEXT,
  target_screens TEXT[] DEFAULT '{HOME}',
  display_rule TEXT DEFAULT 'ONCE_PER_SESSION' CHECK (display_rule IN ('ONCE_EVER','ONCE_PER_SESSION','EVERY_TIME')),
  show_for TEXT DEFAULT 'ALL' CHECK (show_for IN ('ALL','GUEST_ONLY','LOGGED_IN_ONLY')),
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_popups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_popups' AND policyname = 'Allow public read for active popups') THEN
    CREATE POLICY "Allow public read for active popups" ON public.app_popups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_popups' AND policyname = 'Allow admin full access') THEN
    CREATE POLICY "Allow admin full access" ON public.app_popups FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed: existing welcome bonus popup (currently hardcoded in mobile app)
INSERT INTO public.app_popups (title, body, icon, primary_button_text, primary_button_action, secondary_button_text, target_screens, display_rule, show_for, is_active, priority)
VALUES (
  'Login to get ₹1,000',
  'Welcome Bonus on your first login. Use it on service bookings and membership.',
  'gift',
  'Login Now',
  'LOGIN',
  'Maybe later',
  '{HOME}',
  'ONCE_PER_SESSION',
  'GUEST_ONLY',
  true,
  10
) ON CONFLICT DO NOTHING;
