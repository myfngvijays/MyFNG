-- ============================================
-- INVOICE & PAYMENT FLOW - DATABASE UPDATES
-- Date: November 26, 2025
-- Purpose: Add missing fields for complete invoice + payment flow
-- ============================================

-- ============================================
-- STEP 1: Update invoices table with missing fields
-- ============================================

-- Invoice Review Fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved_by UUID REFERENCES users_login(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved_at TIMESTAMP WITH TIME ZONE;

-- Payment Remarks Fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_received_by UUID REFERENCES users_login(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_remarks TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMP WITH TIME ZONE;

-- Invoice Details Fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply_state_code VARCHAR(10);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hsn_sac_codes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;

-- Invoice Sharing Fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via_sms BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via_email BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;

-- Invoice Status Enhancement
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'GENERATED';
-- Status values: GENERATED, APPROVED, SENT, VIEWED, AWAITING_PAYMENT, PAID, CANCELLED

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_approved ON invoices(invoice_approved);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_received_by ON invoices(payment_received_by);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================
-- STEP 2: Create/Update payment_transactions table
-- ============================================

-- Create payment_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  
  -- Payment Details
  payment_method VARCHAR(50) NOT NULL, -- UPI, CARD, NETBANKING, WALLET, CASH, POS
  payment_gateway VARCHAR(50), -- RAZORPAY, STRIPE, PHONEPE, PAYTM, OFFLINE
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  
  -- UPI Details
  upi_id VARCHAR(100),
  upi_txn_id VARCHAR(100),
  
  -- Card Details (masked)
  card_last4 VARCHAR(4),
  card_brand VARCHAR(50),
  card_type VARCHAR(50), -- CREDIT, DEBIT
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED
  failure_reason TEXT,
  
  -- Timestamps
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  
  -- Refund
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status VARCHAR(50), -- PENDING, PROCESSING, COMPLETED, FAILED
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_txn_id VARCHAR(100),
  
  -- Webhook
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_data JSONB,
  
  -- Notes
  notes TEXT,
  customer_note TEXT,
  
  -- Payment Remarks (NEW)
  payment_received_by UUID REFERENCES users_login(id),
  payment_remarks TEXT,
  staff_name VARCHAR(255),
  
  -- Audit
  created_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if table already exists (for existing installations)
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_received_by UUID REFERENCES users_login(id);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_remarks TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255);

-- Add indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_lead_id ON payment_transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_order_id ON payment_transactions(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_received_by ON payment_transactions(payment_received_by);

-- ============================================
-- STEP 3: Create invoice_reviews table (for audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL REFERENCES users_login(id),
  review_status VARCHAR(50) NOT NULL, -- APPROVED, REJECTED, PENDING
  review_notes TEXT,
  items_verified BOOLEAN DEFAULT false,
  taxes_verified BOOLEAN DEFAULT false,
  customer_details_verified BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reviews_invoice_id ON invoice_reviews(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reviews_reviewed_by ON invoice_reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_invoice_reviews_status ON invoice_reviews(review_status);

-- ============================================
-- STEP 4: Create invoice_sharing_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_sharing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES users_login(id),
  sharing_method VARCHAR(50) NOT NULL, -- WHATSAPP, SMS, EMAIL, IN_APP
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  sharing_status VARCHAR(50) DEFAULT 'SENT', -- SENT, DELIVERED, FAILED, VIEWED
  sharing_link TEXT,
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_sharing_logs_invoice_id ON invoice_sharing_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sharing_logs_method ON invoice_sharing_logs(sharing_method);

-- ============================================
-- STEP 5: Add comments/notes
-- ============================================

-- ============================================
-- STEP 6: Verify tables exist (safety check)
-- ============================================

-- Ensure invoices table exists (should already exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
        RAISE EXCEPTION 'invoices table does not exist. Please create it first.';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_leads') THEN
        RAISE EXCEPTION 'service_leads table does not exist. Please create it first.';
    END IF;
    
    RAISE NOTICE 'Invoice & Payment Flow database updates completed!';
    RAISE NOTICE 'Added fields: invoice_approved, payment_received_by, payment_remarks, place_of_supply, etc.';
    RAISE NOTICE 'Created/Updated tables: payment_transactions, invoice_reviews, invoice_sharing_logs';
END $$;

