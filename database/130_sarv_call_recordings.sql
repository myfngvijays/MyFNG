-- =====================================================
-- Migration: SARV call recordings integration
-- Purpose: Store SARV payloads + map aansh to telecaller with time ranges
-- =====================================================

-- Enable extension needed for exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Aansh to telecaller mapping (time-based)
CREATE TABLE IF NOT EXISTS public.sarv_aansh_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aansh_id BIGINT NOT NULL,
  telecaller_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Prevent overlapping mappings for the same aansh_id
ALTER TABLE public.sarv_aansh_mappings
  ADD CONSTRAINT sarv_aansh_mappings_no_overlap
  EXCLUDE USING gist (
    aansh_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[]') WITH &&
  );

CREATE INDEX IF NOT EXISTS idx_sarv_aansh_mappings_aansh
  ON public.sarv_aansh_mappings(aansh_id);

CREATE INDEX IF NOT EXISTS idx_sarv_aansh_mappings_telecaller
  ON public.sarv_aansh_mappings(telecaller_id);

-- 2) SARV calls master table
CREATE TABLE IF NOT EXISTS public.sarv_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  callid TEXT NOT NULL UNIQUE,

  -- SARV metadata
  userid TEXT,
  masteragent BIGINT,
  masteragentnumber TEXT,
  telecaller_id UUID REFERENCES public.users_login(id),
  cnumber TEXT,
  did TEXT,
  ctype TEXT,
  callstatus INTEGER,

  ivrstime TIMESTAMP,
  ivretime TIMESTAMP,
  ivrduration INTEGER,
  talkduration INTEGER,
  agentoncallduration INTEGER,
  custanswerstime TIMESTAMP,
  custansweretime TIMESTAMP,
  custanswerduration INTEGER,

  recording_url TEXT,
  transcription TEXT,
  summary TEXT,
  disposition TEXT,
  disposition_category TEXT,
  disposition_note TEXT,
  disposition_updated_at TIMESTAMP,

  sarv_created_at TIMESTAMP,
  raw_payload JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sarv_calls_created_at
  ON public.sarv_calls(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sarv_calls_masteragent
  ON public.sarv_calls(masteragent);

-- 3) Link SARV calls to RSA complaints
CREATE TABLE IF NOT EXISTS public.sarv_call_rsa_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sarv_call_id UUID NOT NULL REFERENCES public.sarv_calls(id) ON DELETE CASCADE,
  rsa_lead_id UUID NOT NULL REFERENCES public.rsa_leads(id) ON DELETE CASCADE,
  matched_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE (sarv_call_id, rsa_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_sarv_call_rsa_links_rsa_lead
  ON public.sarv_call_rsa_links(rsa_lead_id);

CREATE INDEX IF NOT EXISTS idx_sarv_call_rsa_links_call
  ON public.sarv_call_rsa_links(sarv_call_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ SARV call recording tables created successfully!';
END $$;

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.sarv_aansh_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarv_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarv_call_rsa_links ENABLE ROW LEVEL SECURITY;

-- Helper policy: admins can manage all
DROP POLICY IF EXISTS "Admins can manage sarv_aansh_mappings" ON public.sarv_aansh_mappings;
CREATE POLICY "Admins can manage sarv_aansh_mappings" ON public.sarv_aansh_mappings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

DROP POLICY IF EXISTS "Telecallers can view their own sarv_aansh_mappings" ON public.sarv_aansh_mappings;
CREATE POLICY "Telecallers can view their own sarv_aansh_mappings" ON public.sarv_aansh_mappings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND sarv_aansh_mappings.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
      )
  )
);

-- sarv_calls: telecaller can view own, admins manage all
DROP POLICY IF EXISTS "Telecallers can view their own sarv_calls" ON public.sarv_calls;
CREATE POLICY "Telecallers can view their own sarv_calls" ON public.sarv_calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND sarv_calls.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
      )
  )
);

DROP POLICY IF EXISTS "Admins can manage sarv_calls" ON public.sarv_calls;
CREATE POLICY "Admins can manage sarv_calls" ON public.sarv_calls
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

-- sarv_call_rsa_links: telecaller can view their linked calls
DROP POLICY IF EXISTS "Telecallers can view their sarv_call_rsa_links" ON public.sarv_call_rsa_links;
CREATE POLICY "Telecallers can view their sarv_call_rsa_links" ON public.sarv_call_rsa_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    JOIN public.sarv_calls sc ON sc.id = sarv_call_rsa_links.sarv_call_id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code = 'TELECALLER' AND sc.telecaller_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
      )
  )
);

DROP POLICY IF EXISTS "Admins can manage sarv_call_rsa_links" ON public.sarv_call_rsa_links;
CREATE POLICY "Admins can manage sarv_call_rsa_links" ON public.sarv_call_rsa_links
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies enabled for SARV tables';
END $$;
