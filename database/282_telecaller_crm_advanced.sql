-- Advanced Telecaller CRM: attendance + lead transfer/share
-- Run after existing telecaller tables

CREATE TABLE IF NOT EXISTS telecaller_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecaller_id UUID NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  punch_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  punch_out_at TIMESTAMPTZ,
  punch_in_lat DOUBLE PRECISION,
  punch_in_lng DOUBLE PRECISION,
  punch_out_lat DOUBLE PRECISION,
  punch_out_lng DOUBLE PRECISION,
  notes TEXT,
  work_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telecaller_attendance_user_date
  ON telecaller_attendance (telecaller_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_telecaller_attendance_open
  ON telecaller_attendance (telecaller_id)
  WHERE punch_out_at IS NULL;

CREATE TABLE IF NOT EXISTS telecaller_lead_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  from_telecaller_id UUID NOT NULL REFERENCES users_login(id),
  to_telecaller_id UUID NOT NULL REFERENCES users_login(id),
  transfer_type TEXT NOT NULL DEFAULT 'TRANSFER'
    CHECK (transfer_type IN ('TRANSFER', 'SHARE', 'ESCALATE')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telecaller_lead_transfers_lead
  ON telecaller_lead_transfers (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telecaller_lead_transfers_to
  ON telecaller_lead_transfers (to_telecaller_id, created_at DESC);

COMMENT ON TABLE telecaller_attendance IS 'Telecaller punch in/out for workforce timings';
COMMENT ON TABLE telecaller_lead_transfers IS 'Peer lead transfer/share history between telecallers';
