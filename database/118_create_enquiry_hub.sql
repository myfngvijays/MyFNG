-- ============================================================
-- 118_create_enquiry_hub.sql
-- Purpose: Single-table enquiry leads + telecaller allocation
-- ============================================================

BEGIN;

-- ============================================================
-- Table: enquiry_hub (single-table requirement)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enquiry_hub (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Row type
  kind VARCHAR(30) NOT NULL, -- LEAD | ALLOCATION | ALLOCATOR_STATE
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Common fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB DEFAULT '{}'::jsonb,

  -- ============================================================
  -- LEAD fields (only when kind='LEAD')
  -- ============================================================
  lead_number VARCHAR(50),
  lead_type VARCHAR(30), -- CAR_SERVICE | HOME_CAR_SERVICE | RSA
  lead_status VARCHAR(30) DEFAULT 'NEW',
  lead_priority VARCHAR(20) DEFAULT 'NORMAL',

  lead_source VARCHAR(50),
  lead_source_other_note TEXT,

  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  customer_alt_phone VARCHAR(20),
  customer_email VARCHAR(120),
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_pincode VARCHAR(10),
  customer_lat DECIMAL(10,7),
  customer_lng DECIMAL(10,7),

  vehicle_number VARCHAR(20),
  vehicle_make VARCHAR(60),
  vehicle_model VARCHAR(80),
  vehicle_variant VARCHAR(80),
  vehicle_fuel_type VARCHAR(20),

  problem_description TEXT,
  pickup_required BOOLEAN DEFAULT false,
  preferred_slot_start TIMESTAMPTZ,
  preferred_slot_end TIMESTAMPTZ,

  assigned_telecaller_id UUID REFERENCES public.users_login(id),
  assigned_at TIMESTAMPTZ,
  assignment_mode VARCHAR(20) DEFAULT 'AUTO', -- AUTO | MANUAL

  disposition VARCHAR(60),
  disposition_note TEXT,

  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_call_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  total_calls INTEGER DEFAULT 0,

  closed_at TIMESTAMPTZ,

  -- ============================================================
  -- ALLOCATION fields (only when kind='ALLOCATION')
  -- ============================================================
  telecaller_id UUID REFERENCES public.users_login(id),
  allocation_percent NUMERIC(5,2),
  allocation_status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE
  daily_limit INTEGER,

  -- ============================================================
  -- ALLOCATOR_STATE fields (only when kind='ALLOCATOR_STATE')
  -- ============================================================
  state_key VARCHAR(50),
  state JSONB DEFAULT '{}'::jsonb,

  -- ============================================================
  -- Constraints
  -- ============================================================
  CONSTRAINT enquiry_hub_kind_chk CHECK (kind IN ('LEAD', 'ALLOCATION', 'ALLOCATOR_STATE')),

  CONSTRAINT enquiry_hub_lead_type_chk CHECK (
    kind <> 'LEAD' OR lead_type IN ('CAR_SERVICE', 'HOME_CAR_SERVICE', 'RSA')
  ),
  CONSTRAINT enquiry_hub_lead_status_chk CHECK (
    kind <> 'LEAD' OR lead_status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'FOLLOW_UP', 'CLOSED')
  ),
  CONSTRAINT enquiry_hub_lead_priority_chk CHECK (
    kind <> 'LEAD' OR lead_priority IN ('LOW', 'NORMAL', 'HIGH')
  ),
  CONSTRAINT enquiry_hub_lead_source_chk CHECK (
    kind <> 'LEAD' OR lead_source IN (
      'Google Ads',
      'Instagram Ads',
      'WhatsApp',
      'Website',
      'App Booking',
      'Banner/Offline',
      'Reference',
      'Partner',
      'Other'
    )
  ),
  CONSTRAINT enquiry_hub_lead_source_other_chk CHECK (
    kind <> 'LEAD' OR lead_source <> 'Other' OR lead_source_other_note IS NOT NULL
  ),
  CONSTRAINT enquiry_hub_disposition_chk CHECK (
    kind <> 'LEAD' OR disposition IS NULL OR disposition IN (
      'CUSTOMER_NOT_INTERESTED',
      'WRONG_NUMBER',
      'DUPLICATE_LEAD',
      'ALREADY_SERVICED_ELSEWHERE',
      'QUALIFIED'
    )
  ),
  CONSTRAINT enquiry_hub_allocation_percent_chk CHECK (
    kind <> 'ALLOCATION' OR (allocation_percent >= 0 AND allocation_percent <= 100)
  )
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_kind ON public.enquiry_hub(kind);
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_lead_status ON public.enquiry_hub(lead_status) WHERE kind = 'LEAD';
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_lead_type ON public.enquiry_hub(lead_type) WHERE kind = 'LEAD';
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_lead_source ON public.enquiry_hub(lead_source) WHERE kind = 'LEAD';
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_assigned_telecaller ON public.enquiry_hub(assigned_telecaller_id) WHERE kind = 'LEAD';
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_next_follow_up ON public.enquiry_hub(next_follow_up_at) WHERE kind = 'LEAD' AND next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enquiry_hub_created_at ON public.enquiry_hub(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_enquiry_hub_lead_number ON public.enquiry_hub(lead_number)
  WHERE kind = 'LEAD' AND lead_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_enquiry_hub_allocation_telecaller ON public.enquiry_hub(telecaller_id)
  WHERE kind = 'ALLOCATION' AND is_active = true AND telecaller_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_enquiry_hub_state_key ON public.enquiry_hub(state_key)
  WHERE kind = 'ALLOCATOR_STATE' AND state_key IS NOT NULL;

-- ============================================================
-- Updated_at trigger (best-effort)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_enquiry_hub_updated_at ON public.enquiry_hub;
    CREATE TRIGGER trg_enquiry_hub_updated_at
      BEFORE UPDATE ON public.enquiry_hub
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.enquiry_hub ENABLE ROW LEVEL SECURITY;

-- Super Admin: full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='enquiry_hub'
      AND policyname='Super admins can manage enquiry_hub'
  ) THEN
    CREATE POLICY "Super admins can manage enquiry_hub"
      ON public.enquiry_hub
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

-- Telecaller: access only assigned LEAD rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='enquiry_hub'
      AND policyname='Telecallers can view assigned enquiry leads'
  ) THEN
    CREATE POLICY "Telecallers can view assigned enquiry leads"
      ON public.enquiry_hub
      FOR SELECT
      USING (
        kind = 'LEAD'
        AND assigned_telecaller_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'TELECALLER'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='enquiry_hub'
      AND policyname='Telecallers can update assigned enquiry leads'
  ) THEN
    CREATE POLICY "Telecallers can update assigned enquiry leads"
      ON public.enquiry_hub
      FOR UPDATE
      USING (
        kind = 'LEAD'
        AND assigned_telecaller_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'TELECALLER'
        )
      )
      WITH CHECK (
        kind = 'LEAD'
        AND assigned_telecaller_id = auth.uid()
      );
  END IF;
END $$;

-- Allow lead managers to read lead rows (optional for oversight)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='enquiry_hub'
      AND policyname='Lead managers can view enquiry leads'
  ) THEN
    CREATE POLICY "Lead managers can view enquiry leads"
      ON public.enquiry_hub
      FOR SELECT
      USING (
        kind = 'LEAD'
        AND EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code IN ('LEAD_MANAGER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ enquiry_hub table created/updated successfully!';
END $$;

