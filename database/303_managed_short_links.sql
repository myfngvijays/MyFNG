-- ============================================
-- Link Manager (Bitly-style) — short links, QR codes & click tracking
-- Public redirect: https://myfng.in/s/{short_code}
-- ============================================

CREATE TABLE IF NOT EXISTS public.managed_short_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code VARCHAR(32) NOT NULL UNIQUE,
  long_url TEXT NOT NULL,
  title VARCHAR(200),
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  qr_code_url TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  qr_scans INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users_login(id),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.managed_short_link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES public.managed_short_links(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL DEFAULT 'click',
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managed_short_links_code ON public.managed_short_links (short_code);
CREATE INDEX IF NOT EXISTS idx_managed_short_links_created_at ON public.managed_short_links (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_managed_short_links_active ON public.managed_short_links (is_active);
CREATE INDEX IF NOT EXISTS idx_managed_short_link_clicks_link ON public.managed_short_link_clicks (link_id, created_at DESC);

COMMENT ON TABLE public.managed_short_links IS 'Admin-managed Bitly-style short links with QR and analytics';
COMMENT ON TABLE public.managed_short_link_clicks IS 'Click/scan events for managed short links';

ALTER TABLE public.managed_short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managed_short_link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS managed_short_links_super_admin ON public.managed_short_links;
CREATE POLICY managed_short_links_super_admin
ON public.managed_short_links
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

DROP POLICY IF EXISTS managed_short_link_clicks_super_admin ON public.managed_short_link_clicks;
CREATE POLICY managed_short_link_clicks_super_admin
ON public.managed_short_link_clicks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);
