-- ============================================
-- PHASE 1.3: PAYMENT INTENTS TABLE
-- Purpose: Track payment intents and allowed methods
-- Date: November 26, 2025
-- ============================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Invoice Reference
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  
  -- Allowed Payment Methods
  allowed_methods JSONB DEFAULT '[]'::jsonb,
  -- ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'CASH', 'POS', 'COD', 'CREDIT']
  
  -- Status
  status VARCHAR(50) DEFAULT 'CREATED',
  -- CREATED, COMPLETED, CANCELLED, EXPIRED
  
  -- Payment Gateway Order (if online)
  gateway_order_id VARCHAR(100),
  gateway_session_id VARCHAR(100),
  
  -- QR Code (for UPI)
  qr_code_url TEXT,
  qr_code_data TEXT,
  
  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice_id ON payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_lead_id ON payment_intents(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_gateway_order_id ON payment_intents(gateway_order_id);

-- Comments
COMMENT ON TABLE payment_intents IS 'Payment intents for invoices with allowed payment methods';
COMMENT ON COLUMN payment_intents.allowed_methods IS 'Array of allowed payment methods based on workshop policy';

