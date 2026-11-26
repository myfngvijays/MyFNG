-- Snapshot CRM status when a lead is peer-transferred (for Transferred Leads menu)

ALTER TABLE telecaller_lead_transfers
  ADD COLUMN IF NOT EXISTS lead_status_at_transfer TEXT,
  ADD COLUMN IF NOT EXISTS lead_display_status_at_transfer TEXT;

CREATE INDEX IF NOT EXISTS idx_telecaller_lead_transfers_from_created
  ON telecaller_lead_transfers (from_telecaller_id, created_at DESC);

COMMENT ON COLUMN telecaller_lead_transfers.lead_status_at_transfer IS 'service_leads.status at transfer time';
COMMENT ON COLUMN telecaller_lead_transfers.lead_display_status_at_transfer IS 'Friendly CRM label at transfer time';