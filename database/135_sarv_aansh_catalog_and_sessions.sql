-- =====================================================
-- Migration: SARV Aansh catalog + session-based locking
-- Purpose: Session-based Aansh allocation for TELECALLER/RSA_MANAGER
-- =====================================================

-- 1) Master catalog of available Aansh IDs (super_admin manages these)
CREATE TABLE IF NOT EXISTS public.sarv_aansh_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aansh_id BIGINT NOT NULL UNIQUE,
  system_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.sarv_aansh_catalog
  ADD COLUMN IF NOT EXISTS system_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sarv_aansh_catalog_active
  ON public.sarv_aansh_catalog(aansh_id) WHERE is_active = true;

-- 2) Active session locks: one row per claimed Aansh until release or expiry
CREATE TABLE IF NOT EXISTS public.sarv_aansh_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aansh_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  assignee_role VARCHAR(30) NOT NULL CHECK (assignee_role IN ('TELECALLER', 'RSA_MANAGER')),
  session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Only one active session per aansh_id (released_at IS NULL = still held)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sarv_aansh_sessions_one_active_per_aansh
  ON public.sarv_aansh_sessions(aansh_id) WHERE released_at IS NULL;

-- One active session per user (one Aansh per user at a time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sarv_aansh_sessions_one_active_per_user
  ON public.sarv_aansh_sessions(user_id) WHERE released_at IS NULL;

-- Fast lookup by expires_at for stale cleanup and webhook resolution
CREATE INDEX IF NOT EXISTS idx_sarv_aansh_sessions_expires_at
  ON public.sarv_aansh_sessions(expires_at) WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sarv_aansh_sessions_aansh_active
  ON public.sarv_aansh_sessions(aansh_id) WHERE released_at IS NULL;

-- 3) Seed catalog from existing sarv_aansh_mappings (distinct aansh_id)
INSERT INTO public.sarv_aansh_catalog (aansh_id, is_active)
SELECT DISTINCT aansh_id, true
FROM public.sarv_aansh_mappings
ON CONFLICT (aansh_id) DO NOTHING;

-- 4) RLS
ALTER TABLE public.sarv_aansh_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarv_aansh_sessions ENABLE ROW LEVEL SECURITY;

-- Admins manage catalog
DROP POLICY IF EXISTS "Admins can manage sarv_aansh_catalog" ON public.sarv_aansh_catalog;
CREATE POLICY "Admins can manage sarv_aansh_catalog" ON public.sarv_aansh_catalog
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Telecaller/RSA_MANAGER can read catalog (to see available IDs)
DROP POLICY IF EXISTS "Eligible roles can read sarv_aansh_catalog" ON public.sarv_aansh_catalog;
CREATE POLICY "Eligible roles can read sarv_aansh_catalog" ON public.sarv_aansh_catalog
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Users can manage their own sessions (claim/heartbeat/release)
DROP POLICY IF EXISTS "Users can manage own sarv_aansh_sessions" ON public.sarv_aansh_sessions;
CREATE POLICY "Users can manage own sarv_aansh_sessions" ON public.sarv_aansh_sessions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all sessions (for monitor)
DROP POLICY IF EXISTS "Admins can view all sarv_aansh_sessions" ON public.sarv_aansh_sessions;
CREATE POLICY "Admins can view all sarv_aansh_sessions" ON public.sarv_aansh_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid() OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ SARV Aansh catalog and sessions tables created';
END $$;
