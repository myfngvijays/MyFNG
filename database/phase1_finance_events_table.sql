-- ============================================
-- PHASE 1: FINANCE EVENTS TABLE
-- Purpose: Track all financial events for audit trail
-- Date: November 26, 2025
-- ============================================

CREATE TABLE IF NOT EXISTS finance_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event Details
  event_type VARCHAR(50) NOT NULL,
  -- invoice_created, invoice_approved, invoice_rejected, invoice_sent,
  -- payment_received, payment_failed, receipt_sent, refund_requested,
  -- refund_processed, payout_created, payout_approved, payout_executed
  
  entity_type VARCHAR(50) NOT NULL,
  -- invoice, payment, payout, refund, receipt
  
  entity_id UUID NOT NULL,
  -- Reference to the entity (invoice_id, payment_id, etc.)
  
  -- Actor Information
  actor_id UUID REFERENCES users_login(id),
  actor_role VARCHAR(50),
  actor_name VARCHAR(255),
  
  -- Event Data
  event_data JSONB DEFAULT '{}'::jsonb,
  -- Stores complete snapshot of the event
  
  -- Request Context
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_finance_events_event_type ON finance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_entity_type ON finance_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_entity_id ON finance_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_actor_id ON finance_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_created_at ON finance_events(created_at DESC);

-- Comments
COMMENT ON TABLE finance_events IS 'Immutable audit trail for all financial events';
COMMENT ON COLUMN finance_events.event_type IS 'Type of financial event that occurred';
COMMENT ON COLUMN finance_events.entity_type IS 'Type of entity (invoice, payment, etc.)';
COMMENT ON COLUMN finance_events.entity_id IS 'ID of the entity this event relates to';
COMMENT ON COLUMN finance_events.event_data IS 'Complete snapshot of event data in JSON format';

