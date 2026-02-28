-- ============================================
-- Bot flow builder tables (DoubleTick-style)
-- Purpose: versioned WhatsApp bot flow definitions + audit trail
-- ============================================

CREATE TABLE IF NOT EXISTS public.bot_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'WHATSAPP',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  active_version_id UUID NULL,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bot_flow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  graph_json JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{}}'::jsonb,
  validation_summary JSONB NOT NULL DEFAULT '{"errors":[],"warnings":[]}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE NULL,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(bot_flow_id, version_no)
);

ALTER TABLE public.bot_flows
  ADD CONSTRAINT bot_flows_active_version_fk
  FOREIGN KEY (active_version_id)
  REFERENCES public.bot_flow_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS public.bot_flow_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
  version_id UUID NULL REFERENCES public.bot_flow_versions(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  actor_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_flows_status ON public.bot_flows(status);
CREATE INDEX IF NOT EXISTS idx_bot_flows_created_at ON public.bot_flows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_flow_versions_bot_flow_id ON public.bot_flow_versions(bot_flow_id);
CREATE INDEX IF NOT EXISTS idx_bot_flow_versions_status ON public.bot_flow_versions(status);
CREATE INDEX IF NOT EXISTS idx_bot_flow_versions_created_at ON public.bot_flow_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_flow_events_bot_flow_id ON public.bot_flow_events(bot_flow_id);
CREATE INDEX IF NOT EXISTS idx_bot_flow_events_created_at ON public.bot_flow_events(created_at DESC);

-- 4) Security: lock down with RLS (admin only)
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage bot_flows" ON public.bot_flows;
CREATE POLICY "Admins can manage bot_flows" ON public.bot_flows
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DROP POLICY IF EXISTS "Admins can manage bot_flow_versions" ON public.bot_flow_versions;
CREATE POLICY "Admins can manage bot_flow_versions" ON public.bot_flow_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DROP POLICY IF EXISTS "Admins can manage bot_flow_events" ON public.bot_flow_events;
CREATE POLICY "Admins can manage bot_flow_events" ON public.bot_flow_events
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

