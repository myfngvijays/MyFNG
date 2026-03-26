-- CRM Enquiries table
CREATE TABLE IF NOT EXISTS crm_enquiries (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_no      TEXT NOT NULL,
  name          TEXT,
  address       TEXT,
  regdate       DATE,
  car_number    TEXT,
  make          TEXT,
  model         TEXT,
  disposition   TEXT,
  remark        TEXT,
  dialer_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index on phone_no for fast lookups
CREATE INDEX IF NOT EXISTS idx_crm_enquiries_phone_no ON crm_enquiries (phone_no);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_crm_enquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_enquiries_updated_at
  BEFORE UPDATE ON crm_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_enquiries_updated_at();

-- Enable RLS
ALTER TABLE crm_enquiries ENABLE ROW LEVEL SECURITY;

-- Public access policies (select, insert, update, delete for anon & authenticated)
CREATE POLICY "Allow public read access"
  ON crm_enquiries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access"
  ON crm_enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON crm_enquiries FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON crm_enquiries FOR DELETE
  TO anon, authenticated
  USING (true);
