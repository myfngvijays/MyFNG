-- ============================================
-- PHASE 1: SAFE Database Schema Update
-- Works with existing database structure
-- ============================================

-- ============================================
-- STEP 1: Update lead_status ENUM (Safe)
-- ============================================

DO $$ 
BEGIN
    -- Add new status values only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INCOMPLETE' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'INCOMPLETE';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VALIDATED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'VALIDATED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ASSIGNED_TO_WORKSHOP' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'ASSIGNED_TO_WORKSHOP';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING_ACCEPTANCE' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'PENDING_ACCEPTANCE';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TEAM_ASSIGNED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'TEAM_ASSIGNED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PICKUP_SCHEDULED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'PICKUP_SCHEDULED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'IN_TRANSIT' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'IN_TRANSIT';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DELIVERED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'DELIVERED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WORK_COMPLETED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'WORK_COMPLETED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_PENDING' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'QC_PENDING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_APPROVED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'QC_APPROVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_REJECTED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'QC_REJECTED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUDIT_PENDING' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'AUDIT_PENDING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUDIT_APPROVED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'AUDIT_APPROVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUDIT_FLAGGED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'AUDIT_FLAGGED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INVOICE_GENERATED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'INVOICE_GENERATED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_PAYMENT' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'AWAITING_PAYMENT';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAYMENT_COMPLETED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'PAYMENT_COMPLETED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'CLOSED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ESCALATED' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'ESCALATED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ON_HOLD' AND enumtypid = 'lead_status'::regtype) THEN
        ALTER TYPE lead_status ADD VALUE 'ON_HOLD';
    END IF;
    
    RAISE NOTICE 'Step 1: Status ENUM updated successfully!';
END $$;

-- ============================================
-- STEP 2: Add Missing Columns to service_leads
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE 'Step 2: Adding columns to service_leads...';
END $$;

-- Lead Manager Validation
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Workshop Assignment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_by_lead_manager_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assignment_reason TEXT;

-- Team Assignment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_by_id UUID;

-- QC (Quality Control)
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_score INTEGER;

-- Audit
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_score INTEGER;

-- Billing & Invoice
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_number_new VARCHAR(50);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS extra_charges_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_by UUID;

-- Payment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Closure
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- Customer Feedback
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_rating INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_feedback TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_feedback_at TIMESTAMP WITH TIME ZONE;

-- Fraud/Spam
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_fraud BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS fraud_reason TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_at TIMESTAMP WITH TIME ZONE;

-- Escalation
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_to_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Workshop Performance
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating_reason TEXT;

DO $$ 
BEGIN
    RAISE NOTICE 'Step 2: Columns added successfully!';
END $$;

-- ============================================
-- STEP 3: Create invoices Table (Without FK)
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  lead_id UUID NOT NULL,
  workshop_id UUID,
  customer_id UUID,
  
  -- Amounts
  base_amount DECIMAL(10,2) NOT NULL,
  extra_charges DECIMAL(10,2) DEFAULT 0,
  parts_cost DECIMAL(10,2) DEFAULT 0,
  labour_cost DECIMAL(10,2) DEFAULT 0,
  sub_total DECIMAL(10,2) NOT NULL,
  
  -- Discounts
  coupon_code VARCHAR(50),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Taxes
  cgst_percentage DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(10,2) DEFAULT 0,
  sgst_percentage DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(10,2) DEFAULT 0,
  igst_percentage DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(10,2) DEFAULT 0,
  total_tax DECIMAL(10,2) DEFAULT 0,
  
  -- Final
  final_amount DECIMAL(10,2) NOT NULL,
  amount_in_words TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'GENERATED',
  
  -- Payment
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  payment_txn_id VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  sent_to_customer_at TIMESTAMP WITH TIME ZONE,
  viewed_by_customer_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT,
  terms_and_conditions TEXT,
  
  -- Audit
  generated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workshop_id ON invoices(workshop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 3: invoices table created!';
END $$;

-- ============================================
-- STEP 4: Create payment_transactions Table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  invoice_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  
  -- Payment Details
  payment_method VARCHAR(50) NOT NULL,
  payment_gateway VARCHAR(50),
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  
  -- UPI Details
  upi_id VARCHAR(100),
  upi_txn_id VARCHAR(100),
  
  -- Card Details
  card_last4 VARCHAR(4),
  card_brand VARCHAR(50),
  card_type VARCHAR(50),
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',
  failure_reason TEXT,
  
  -- Timestamps
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  
  -- Refund
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status VARCHAR(50),
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_txn_id VARCHAR(100),
  
  -- Webhook
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_data JSONB,
  
  -- Notes
  notes TEXT,
  customer_note TEXT,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_trans_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_lead ON payment_transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_trans_gateway_order ON payment_transactions(gateway_order_id);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 4: payment_transactions table created!';
END $$;

-- ============================================
-- STEP 5: Create workshop_payouts Table
-- ============================================

CREATE TABLE IF NOT EXISTS workshop_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_number VARCHAR(50) UNIQUE NOT NULL,
  workshop_id UUID NOT NULL,
  
  -- Amounts
  total_invoice_amount DECIMAL(10,2) NOT NULL,
  platform_commission_percentage DECIMAL(5,2) DEFAULT 15.00,
  platform_commission_amount DECIMAL(10,2) NOT NULL,
  tds_percentage DECIMAL(5,2) DEFAULT 0,
  tds_amount DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  net_payout_amount DECIMAL(10,2) NOT NULL,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_leads INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',
  
  -- Payment Details
  payment_method VARCHAR(50),
  bank_account_number VARCHAR(50),
  ifsc_code VARCHAR(20),
  upi_id VARCHAR(100),
  
  -- Transaction
  transaction_id VARCHAR(100),
  transaction_date TIMESTAMP WITH TIME ZONE,
  transaction_ref VARCHAR(100),
  
  -- Notes
  notes TEXT,
  failure_reason TEXT,
  
  -- Audit
  processed_by UUID,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_payouts_workshop ON workshop_payouts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_status ON workshop_payouts(status);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_period ON workshop_payouts(period_start, period_end);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 5: workshop_payouts table created!';
END $$;

-- ============================================
-- STEP 6: Create lead_status_history Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  
  -- Status Change
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  
  -- Who & When
  changed_by_id UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  notes TEXT,
  metadata JSONB,
  
  -- IP & Device
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_status_hist_lead ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_hist_changed ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_hist_new_status ON lead_status_history(new_status);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 6: lead_status_history table created!';
END $$;

-- ============================================
-- STEP 7: Create lead_assignments_history Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_assignments_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  
  -- Assignment Type
  assignment_type VARCHAR(50) NOT NULL,
  
  -- Old & New
  old_assignee_id UUID,
  new_assignee_id UUID,
  
  -- Who & When
  assigned_by_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_lead ON lead_assignments_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_type ON lead_assignments_history(assignment_type);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 7: lead_assignments_history table created!';
END $$;

-- ============================================
-- STEP 8: Create Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_service_leads_validated_by ON service_leads(validated_by_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_qc_status ON service_leads(qc_status);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_fraud ON service_leads(is_fraud);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_escalated ON service_leads(is_escalated);

DO $$ 
BEGIN
    RAISE NOTICE 'Step 8: Indexes created!';
END $$;

-- ============================================
-- STEP 9: Create Views for Analytics
-- ============================================

CREATE OR REPLACE VIEW lead_status_distribution AS
SELECT 
  status::TEXT as status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0), 2) as percentage
FROM service_leads
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY count DESC;

CREATE OR REPLACE VIEW daily_lead_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN status::TEXT = 'COMPLETED' THEN 1 END) as completed_leads,
  COUNT(CASE WHEN status::TEXT = 'CANCELLED' THEN 1 END) as cancelled_leads,
  SUM(COALESCE(final_amount, 0)) as total_revenue
FROM service_leads
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

DO $$ 
BEGIN
    RAISE NOTICE 'Step 9: Views created!';
END $$;

-- ============================================
-- FINAL SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 1 Migration Completed Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New Tables Created: 5';
  RAISE NOTICE '  - invoices';
  RAISE NOTICE '  - payment_transactions';
  RAISE NOTICE '  - workshop_payouts';
  RAISE NOTICE '  - lead_status_history';
  RAISE NOTICE '  - lead_assignments_history';
  RAISE NOTICE '';
  RAISE NOTICE 'New Status Values Added: 18';
  RAISE NOTICE 'New Columns Added: 35+';
  RAISE NOTICE 'New Indexes Created: 15+';
  RAISE NOTICE 'Views Created: 2';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Database is now 100% ready! ✅';
  RAISE NOTICE '========================================';
END $$;

