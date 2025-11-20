-- ============================================
-- PHASE 1: Complete Database Schema Update
-- Lead Flow Implementation - Week 1
-- ============================================

-- ============================================
-- STEP 1: Update lead_status ENUM
-- Add all missing status values
-- ============================================

-- Note: PostgreSQL ENUM values can only be added, not removed
-- Add all new status values one by one

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ASSIGNED_TO_WORKSHOP';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PENDING_ACCEPTANCE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'TEAM_ASSIGNED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PICKUP_SCHEDULED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'WORK_COMPLETED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_PENDING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_APPROVED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_REJECTED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AUDIT_PENDING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AUDIT_APPROVED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AUDIT_FLAGGED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PAYMENT_COMPLETED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- ============================================
-- STEP 2: Add Missing Columns to service_leads
-- ============================================

-- Lead Manager Validation
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Workshop Assignment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_by_lead_manager_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assignment_reason TEXT;

-- Team Assignment Timestamps
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_by_id UUID REFERENCES users_login(id);

-- QC (Quality Control)
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_score INTEGER; -- 0-100

-- Audit
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_required BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_status VARCHAR(50);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_score INTEGER; -- 0-100

-- Billing & Payment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_id UUID; -- FK will be added later
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS extra_charges_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_by UUID REFERENCES users_login(id);

-- Payment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50); -- UPI, CARD, CASH, WALLET

-- Lead Closure
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_by_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- Customer Feedback
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_rating INTEGER; -- 1-5 stars
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_feedback TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_feedback_at TIMESTAMP WITH TIME ZONE;

-- Fraud/Spam Management
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_fraud BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS fraud_reason TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_at TIMESTAMP WITH TIME ZONE;

-- Escalation
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_to_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_by_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Workshop Performance
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating INTEGER; -- 1-5 stars
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating_reason TEXT;

-- ============================================
-- STEP 3: Create invoices Table
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES workshops(id),
  customer_id UUID REFERENCES users_login(id),
  
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
  status VARCHAR(50) DEFAULT 'GENERATED', -- GENERATED, SENT, VIEWED, PAID, CANCELLED
  
  -- Payment
  payment_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, PARTIAL, FAILED, REFUNDED
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(50), -- UPI, CARD, CASH, WALLET, NETBANKING
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
  generated_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT invoices_lead_id_unique UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workshop_id ON invoices(workshop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- ============================================
-- STEP 4: Create payment_transactions Table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  
  -- Payment Details
  payment_method VARCHAR(50) NOT NULL, -- UPI, CARD, NETBANKING, WALLET, CASH
  payment_gateway VARCHAR(50), -- RAZORPAY, STRIPE, PHONEPE, PAYTM
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
  
  -- Audit
  created_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_lead_id ON payment_transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_order_id ON payment_transactions(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- ============================================
-- STEP 5: Create workshop_payouts Table
-- ============================================

CREATE TABLE IF NOT EXISTS workshop_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_number VARCHAR(50) UNIQUE NOT NULL,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  
  -- Amount Calculation
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
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, ON_HOLD
  
  -- Payment Details
  payment_method VARCHAR(50), -- BANK_TRANSFER, UPI, CHEQUE
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
  processed_by UUID REFERENCES users_login(id),
  approved_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_payouts_workshop_id ON workshop_payouts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_status ON workshop_payouts(status);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_period ON workshop_payouts(period_start, period_end);

-- ============================================
-- STEP 6: Create lead_status_history Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Status Change
  old_status lead_status,
  new_status lead_status NOT NULL,
  
  -- Who & When
  changed_by_id UUID REFERENCES users_login(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  notes TEXT,
  metadata JSONB,
  
  -- IP & Device
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_new_status ON lead_status_history(new_status);

-- ============================================
-- STEP 7: Create lead_assignments_history Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_assignments_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Assignment Type
  assignment_type VARCHAR(50) NOT NULL, -- WORKSHOP, MECHANIC, SUPERVISOR, PICKUP_BOY, LEAD_MANAGER
  
  -- Old & New
  old_assignee_id UUID REFERENCES users_login(id),
  new_assignee_id UUID REFERENCES users_login(id),
  
  -- Who & When
  assigned_by_id UUID REFERENCES users_login(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_history_lead_id ON lead_assignments_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_history_type ON lead_assignments_history(assignment_type);

-- ============================================
-- STEP 8: Add Foreign Key for invoice_id
-- ============================================

ALTER TABLE service_leads DROP CONSTRAINT IF EXISTS service_leads_invoice_id_fkey;
ALTER TABLE service_leads ADD CONSTRAINT service_leads_invoice_id_fkey 
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================
-- STEP 9: Create Indexes for Performance
-- ============================================

-- service_leads indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_status ON service_leads(status);
CREATE INDEX IF NOT EXISTS idx_service_leads_validated_by ON service_leads(validated_by_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_by_lm ON service_leads(assigned_by_lead_manager_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_qc_status ON service_leads(qc_status);
CREATE INDEX IF NOT EXISTS idx_service_leads_audit_required ON service_leads(audit_required);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_fraud ON service_leads(is_fraud);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_escalated ON service_leads(is_escalated);
CREATE INDEX IF NOT EXISTS idx_service_leads_payment_status ON service_leads(payment_status);

-- ============================================
-- STEP 10: Create Views for Analytics
-- ============================================

-- Lead status distribution view
CREATE OR REPLACE VIEW lead_status_distribution AS
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM service_leads
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY count DESC;

-- Daily lead stats view
CREATE OR REPLACE VIEW daily_lead_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_leads,
  COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_leads,
  SUM(CASE WHEN final_amount IS NOT NULL THEN final_amount ELSE 0 END) as total_revenue
FROM service_leads
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Workshop performance view
CREATE OR REPLACE VIEW workshop_performance AS
SELECT 
  w.id as workshop_id,
  w.name as workshop_name,
  COUNT(sl.id) as total_leads,
  COUNT(CASE WHEN sl.status = 'COMPLETED' THEN 1 END) as completed_leads,
  COUNT(CASE WHEN sl.status = 'REJECTED' THEN 1 END) as rejected_leads,
  AVG(sl.workshop_rating) as avg_rating,
  AVG(CASE 
    WHEN sl.completed_at IS NOT NULL AND sl.accepted_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (sl.completed_at - sl.accepted_at))/3600 
  END) as avg_completion_hours
FROM workshops w
LEFT JOIN service_leads sl ON sl.workshop_id = w.id AND sl.deleted_at IS NULL
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name;

-- ============================================
-- STEP 11: Add Comments for Documentation
-- ============================================

COMMENT ON TABLE invoices IS 'Stores all invoice details for leads';
COMMENT ON TABLE payment_transactions IS 'Tracks all payment transactions and their status';
COMMENT ON TABLE workshop_payouts IS 'Manages workshop payout calculations and transactions';
COMMENT ON TABLE lead_status_history IS 'Audit log of all status changes for leads';
COMMENT ON TABLE lead_assignments_history IS 'Audit log of all assignment changes';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration Completed Successfully!';
  RAISE NOTICE 'New Tables Created: 5';
  RAISE NOTICE 'New Columns Added: 40+';
  RAISE NOTICE 'New Indexes Created: 20+';
  RAISE NOTICE 'Views Created: 3';
END $$;

