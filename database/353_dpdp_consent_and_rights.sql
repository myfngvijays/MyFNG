-- DPDP Act, 2023: per-purpose consent log + data-principal rights requests.
-- Existing user_consents / data_deletion_requests stay; these tables are the public web path.

CREATE TABLE IF NOT EXISTS dpdp_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  granted boolean NOT NULL,
  source text NOT NULL,
  subject_name text,
  subject_email text,
  subject_phone text,
  user_id uuid,
  ip_address text,
  user_agent text,
  notice_version text NOT NULL DEFAULT '2026-08-26',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpdp_consent_created ON dpdp_consent_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_phone ON dpdp_consent_records (subject_phone);
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_purpose ON dpdp_consent_records (purpose, granted);

CREATE TABLE IF NOT EXISTS data_rights_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  details text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_data_rights_status ON data_rights_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_rights_email ON data_rights_requests (email);

COMMENT ON TABLE dpdp_consent_records IS 'DPDP per-purpose consent (unticked opt-in) from website/app forms and cookie banner';
COMMENT ON TABLE data_rights_requests IS 'DPDP data principal requests: access, correct, erase, withdraw, nominate, grievance';
