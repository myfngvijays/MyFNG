-- ============================================
-- PHASE 1: COMPLETE DATABASE MIGRATION
-- Purpose: All Phase 1 database changes in one file
-- Date: November 26, 2025
-- 
-- This file includes:
-- 1. Finance Events Table
-- 2. Invoice Table Enhancements
-- 3. Short URLs Table
-- 4. Payment Intents Table
-- 5. Workshop Payment Policy Table
--
-- Safe to run multiple times (idempotent)
-- ============================================

BEGIN;

-- ============================================
-- PART 1: FINANCE EVENTS TABLE
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

-- Indexes for finance_events
CREATE INDEX IF NOT EXISTS idx_finance_events_event_type ON finance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_entity_type ON finance_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_entity_id ON finance_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_actor_id ON finance_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_created_at ON finance_events(created_at DESC);

-- Comments for finance_events
COMMENT ON TABLE finance_events IS 'Immutable audit trail for all financial events';
COMMENT ON COLUMN finance_events.event_type IS 'Type of financial event that occurred';
COMMENT ON COLUMN finance_events.entity_type IS 'Type of entity (invoice, payment, etc.)';
COMMENT ON COLUMN finance_events.entity_id IS 'ID of the entity this event relates to';
COMMENT ON COLUMN finance_events.event_data IS 'Complete snapshot of event data in JSON format';

-- ============================================
-- PART 2: INVOICE TABLE ENHANCEMENTS
-- ============================================

-- Add send_failures array to track failed send attempts
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_failures JSONB DEFAULT '[]'::jsonb;

-- Add balance_due for partial payments
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2) DEFAULT 0;

-- Add threshold for second approval
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS requires_second_approval BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS second_approval_threshold DECIMAL(10,2) DEFAULT 50000.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS second_approver_id UUID REFERENCES users_login(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS second_approved_at TIMESTAMP WITH TIME ZONE;

-- Add B2B GSTIN field
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(15);

-- Add receipt fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_generated_at TIMESTAMP WITH TIME ZONE;

-- Add COD fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cod_due_date TIMESTAMP WITH TIME ZONE;

-- Add indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_requires_second_approval ON invoices(requires_second_approval);
CREATE INDEX IF NOT EXISTS idx_invoices_balance_due ON invoices(balance_due);

-- Comments for invoice enhancements
COMMENT ON COLUMN invoices.send_failures IS 'Array of failed send attempts with error details';
COMMENT ON COLUMN invoices.balance_due IS 'Remaining amount due after partial payments';
COMMENT ON COLUMN invoices.requires_second_approval IS 'Whether invoice requires Finance Manager approval';
COMMENT ON COLUMN invoices.customer_gstin IS 'Customer GSTIN for B2B transactions';

-- ============================================
-- PART 3: SHORT URLS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS short_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Short URL Details
  short_code VARCHAR(20) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  
  -- Entity Reference
  entity_type VARCHAR(50) NOT NULL, -- invoice, payment, receipt
  entity_id UUID NOT NULL,
  
  -- Analytics
  clicks INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for short_urls
CREATE INDEX IF NOT EXISTS idx_short_urls_short_code ON short_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_short_urls_entity ON short_urls(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls(created_at DESC);

-- Comments for short_urls
COMMENT ON TABLE short_urls IS 'Short URLs for invoice, payment, and receipt links';
COMMENT ON COLUMN short_urls.short_code IS '8-character short code for URL';
COMMENT ON COLUMN short_urls.clicks IS 'Number of times the short URL was clicked';

-- ============================================
-- PART 4: PAYMENT INTENTS TABLE
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

-- Indexes for payment_intents
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice_id ON payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_lead_id ON payment_intents(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_gateway_order_id ON payment_intents(gateway_order_id);

-- Comments for payment_intents
COMMENT ON TABLE payment_intents IS 'Payment intents for invoices with allowed payment methods';
COMMENT ON COLUMN payment_intents.allowed_methods IS 'Array of allowed payment methods based on workshop policy';

-- ============================================
-- PART 5: WORKSHOP PAYMENT POLICY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workshop_payment_policy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Workshop Reference
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  
  -- Payment Methods Configuration
  allow_online_payment BOOLEAN DEFAULT true,
  allow_cash BOOLEAN DEFAULT true,
  allow_pos BOOLEAN DEFAULT true,
  allow_cod BOOLEAN DEFAULT false,
  allow_credit BOOLEAN DEFAULT false,
  allow_partial_payment BOOLEAN DEFAULT false,
  
  -- Online Payment Methods
  allowed_online_methods JSONB DEFAULT '["UPI", "CARD", "NETBANKING", "WALLET"]'::jsonb,
  
  -- Customer Type Rules
  corporate_allowed_methods JSONB DEFAULT '["UPI", "CARD", "NETBANKING", "CREDIT"]'::jsonb,
  retail_allowed_methods JSONB DEFAULT '["UPI", "CARD", "WALLET", "CASH", "POS"]'::jsonb,
  
  -- Limits & Rules
  min_online_amount DECIMAL(10,2) DEFAULT 0,
  max_cash_amount DECIMAL(10,2) DEFAULT 50000.00,
  cod_max_amount DECIMAL(10,2) DEFAULT 0,
  cod_allowed_days INTEGER DEFAULT 0,
  
  -- Split Payment
  allow_split_payment BOOLEAN DEFAULT false,
  max_split_count INTEGER DEFAULT 1,
  
  -- QR Code Settings
  generate_qr_code BOOLEAN DEFAULT true,
  qr_code_provider VARCHAR(50) DEFAULT 'RAZORPAY', -- RAZORPAY, PHONEPE, PAYTM
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_login(id),
  updated_by UUID REFERENCES users_login(id)
);

-- Indexes for workshop_payment_policy
CREATE INDEX IF NOT EXISTS idx_workshop_payment_policy_workshop_id ON workshop_payment_policy(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payment_policy_active ON workshop_payment_policy(is_active);

-- Comments for workshop_payment_policy
COMMENT ON TABLE workshop_payment_policy IS 'Payment policy configuration per workshop';
COMMENT ON COLUMN workshop_payment_policy.corporate_allowed_methods IS 'Payment methods allowed for corporate/B2B customers';
COMMENT ON COLUMN workshop_payment_policy.retail_allowed_methods IS 'Payment methods allowed for retail customers';

-- ============================================
-- PART 6: PAYMENT TRANSACTIONS ENHANCEMENTS
-- ============================================

-- Add reconciliation fields to payment_transactions
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES users_login(id);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS cash_deposit_pending BOOLEAN DEFAULT false;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS bank_deposit_slip_url TEXT;

-- Add indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reconciled ON payment_transactions(reconciled);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_cash_deposit_pending ON payment_transactions(cash_deposit_pending);

-- ============================================
-- VERIFICATION & SUCCESS MESSAGE
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PHASE 1 DATABASE MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Created:';
    RAISE NOTICE '  ✓ finance_events';
    RAISE NOTICE '  ✓ short_urls';
    RAISE NOTICE '  ✓ payment_intents';
    RAISE NOTICE '  ✓ workshop_payment_policy';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Enhanced:';
    RAISE NOTICE '  ✓ invoices (added 8 new columns)';
    RAISE NOTICE '  ✓ payment_transactions (added 5 new columns)';
    RAISE NOTICE '';
    RAISE NOTICE 'All indexes and comments created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Migration is idempotent - safe to run multiple times.';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================
-- END OF PHASE 1 MIGRATION
-- ============================================

