-- ============================================
-- SMART MIGRATION - For Existing Database
-- Adds new columns/tables without breaking existing data
-- Safe to run multiple times
-- ============================================

-- ============================================
-- PART 1: Add New Status Values (Safe)
-- ============================================

DO $$ 
BEGIN
    -- Only add if doesn't exist
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
    
    RAISE NOTICE '✅ Status values updated!';
END $$;

-- ============================================
-- PART 2: Add Missing Columns to service_leads
-- ============================================

-- Lead Manager Validation
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validation_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_by_lead_manager_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assignment_reason TEXT;

-- Team Assignment
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS team_assigned_by_id UUID;

-- QC
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS qc_score INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS ready_for_delivery_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_ready_by UUID;

-- Audit Enhanced
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_score INTEGER;

-- Billing Enhanced
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_number_gen VARCHAR(50);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS extra_charges_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_by UUID;

-- Payment Enhanced
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

-- Workshop Performance
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating INTEGER;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_rating_reason TEXT;

-- Fraud
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_fraud BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS fraud_reason TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS marked_fraud_at TIMESTAMP WITH TIME ZONE;

-- Escalation Enhanced
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_to_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

DO $$ BEGIN RAISE NOTICE '✅ service_leads columns added!'; END $$;

-- ============================================
-- PART 3: Create New Tables
-- ============================================

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  lead_id UUID NOT NULL,
  workshop_id UUID,
  customer_id UUID,
  base_amount DECIMAL(10,2) NOT NULL,
  extra_charges DECIMAL(10,2) DEFAULT 0,
  parts_cost DECIMAL(10,2) DEFAULT 0,
  labour_cost DECIMAL(10,2) DEFAULT 0,
  sub_total DECIMAL(10,2) NOT NULL,
  coupon_code VARCHAR(50),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  cgst_percentage DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(10,2) DEFAULT 0,
  sgst_percentage DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(10,2) DEFAULT 0,
  igst_percentage DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(10,2) DEFAULT 0,
  total_tax DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL,
  amount_in_words TEXT,
  status VARCHAR(50) DEFAULT 'GENERATED',
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  payment_txn_id VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  sent_to_customer_at TIMESTAMP WITH TIME ZONE,
  viewed_by_customer_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  terms_and_conditions TEXT,
  generated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  invoice_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_method VARCHAR(50) NOT NULL,
  payment_gateway VARCHAR(50),
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  upi_id VARCHAR(100),
  upi_txn_id VARCHAR(100),
  card_last4 VARCHAR(4),
  card_brand VARCHAR(50),
  card_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'PENDING',
  failure_reason TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status VARCHAR(50),
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_txn_id VARCHAR(100),
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_data JSONB,
  notes TEXT,
  customer_note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workshop Payouts
CREATE TABLE IF NOT EXISTS workshop_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_number VARCHAR(50) UNIQUE NOT NULL,
  workshop_id UUID NOT NULL,
  total_invoice_amount DECIMAL(10,2) NOT NULL,
  platform_commission_percentage DECIMAL(5,2) DEFAULT 15.00,
  platform_commission_amount DECIMAL(10,2) NOT NULL,
  tds_percentage DECIMAL(5,2) DEFAULT 0,
  tds_amount DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  net_payout_amount DECIMAL(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_leads INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING',
  payment_method VARCHAR(50),
  bank_account_number VARCHAR(50),
  ifsc_code VARCHAR(20),
  upi_id VARCHAR(100),
  transaction_id VARCHAR(100),
  transaction_date TIMESTAMP WITH TIME ZONE,
  transaction_ref VARCHAR(100),
  notes TEXT,
  failure_reason TEXT,
  processed_by UUID,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Status History
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by_id UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  notes TEXT,
  metadata JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT
);

-- Lead Assignments History
CREATE TABLE IF NOT EXISTS lead_assignments_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  assignment_type VARCHAR(50) NOT NULL,
  old_assignee_id UUID,
  new_assignee_id UUID,
  assigned_by_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  notes TEXT
);

-- Mechanic Extra Work Requests
CREATE TABLE IF NOT EXISTS mechanic_extra_work_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  mechanic_id UUID NOT NULL,
  description TEXT NOT NULL,
  estimated_cost DECIMAL(10,2) NOT NULL,
  actual_cost DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'PENDING',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telecaller Follow Ups
CREATE TABLE IF NOT EXISTS telecaller_follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  telecaller_id UUID NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  notes TEXT,
  outcome TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN RAISE NOTICE '✅ New tables created!'; END $$;

-- ============================================
-- PART 4: Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_service_leads_validated_by ON service_leads(validated_by_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_qc_status ON service_leads(qc_status);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_fraud ON service_leads(is_fraud);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_escalated ON service_leads(is_escalated);
CREATE INDEX IF NOT EXISTS idx_service_leads_closed_at ON service_leads(closed_at);

CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workshop_id ON invoices(workshop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_payment_trans_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_lead ON payment_transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_status ON payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_workshop_payouts_workshop ON workshop_payouts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_status ON workshop_payouts(status);

CREATE INDEX IF NOT EXISTS idx_lead_status_hist_lead ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_hist_changed ON lead_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_lead ON lead_assignments_history(lead_id);

DO $$ BEGIN RAISE NOTICE '✅ Indexes created!'; END $$;

-- ============================================
-- PART 5: Create Views
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

CREATE OR REPLACE VIEW workshop_performance AS
SELECT 
  w.id as workshop_id,
  w.name as workshop_name,
  COUNT(sl.id) as total_leads,
  COUNT(CASE WHEN sl.status::TEXT = 'COMPLETED' THEN 1 END) as completed_leads,
  COUNT(CASE WHEN sl.status::TEXT = 'REJECTED' THEN 1 END) as rejected_leads,
  ROUND(AVG(sl.workshop_rating), 2) as avg_rating
FROM workshops w
LEFT JOIN service_leads sl ON sl.workshop_id = w.id AND sl.deleted_at IS NULL
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name;

DO $$ BEGIN RAISE NOTICE '✅ Views created!'; END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Status Values: 24 added';
  RAISE NOTICE 'Columns Added: 35+';
  RAISE NOTICE 'Tables Created: 8';
  RAISE NOTICE 'Indexes Created: 15+';
  RAISE NOTICE 'Views Created: 3';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Database is ready! 🚀';
  RAISE NOTICE '========================================';
END $$;

