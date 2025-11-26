-- ============================================
-- ALL PHASES: COMPLETE DATABASE MIGRATION
-- Purpose: All remaining phases database changes
-- Date: November 26, 2025
-- 
-- Includes:
-- Phase 2: Delivery & CSE Enhancements
-- Phase 3: Reconciliation & Payouts
-- Phase 4: Archival & Reporting
-- Step 13: Notifications & Audit Trail
--
-- Safe to run multiple times (idempotent)
-- ============================================

BEGIN;

-- ============================================
-- PHASE 2: DELIVERY & CSE ENHANCEMENTS
-- ============================================

-- Add CSE fields to service_leads
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_due BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS csat INTEGER CHECK (csat >= 1 AND csat <= 5);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_notes TEXT;

-- Add delivery verification fields
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS delivery_damage_reported BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS delivery_damage_description TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS delivery_damage_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS delivery_support_ticket_id UUID;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_cse_followup_due ON service_leads(cse_followup_due);
CREATE INDEX IF NOT EXISTS idx_service_leads_csat ON service_leads(csat);
CREATE INDEX IF NOT EXISTS idx_service_leads_delivery_damage ON service_leads(delivery_damage_reported);

-- ============================================
-- PHASE 3: RECONCILIATION TABLES
-- ============================================

-- Reconciliation Exceptions Table
CREATE TABLE IF NOT EXISTS recon_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Payment Reference
  payment_id UUID REFERENCES payment_transactions(id),
  invoice_id UUID REFERENCES invoices(id),
  lead_id UUID REFERENCES service_leads(id),
  
  -- Exception Details
  exception_type VARCHAR(50) NOT NULL,
  -- UNMATCHED, AMOUNT_MISMATCH, DUPLICATE, FAILED, MISSING_REFERENCE
  
  exception_data JSONB DEFAULT '{}'::jsonb,
  -- Stores details of the exception
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',
  -- PENDING, RESOLVED, ESCALATED, IGNORED
  
  -- Resolution
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for recon_exceptions
CREATE INDEX IF NOT EXISTS idx_recon_exceptions_payment_id ON recon_exceptions(payment_id);
CREATE INDEX IF NOT EXISTS idx_recon_exceptions_status ON recon_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_recon_exceptions_type ON recon_exceptions(exception_type);

-- General Ledger Entries Table
CREATE TABLE IF NOT EXISTS gl_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Entry Details
  entry_type VARCHAR(50) NOT NULL,
  -- DEBIT, CREDIT
  
  account_type VARCHAR(50) NOT NULL,
  -- REVENUE, TAX_CGST, TAX_SGST, TAX_IGST, BANK, CASH, ACCOUNTS_RECEIVABLE, ACCOUNTS_PAYABLE
  
  account_name VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  
  -- Reference
  reference_type VARCHAR(50) NOT NULL,
  -- invoice, payment, payout, refund, adjustment
  
  reference_id UUID NOT NULL,
  reference_number VARCHAR(100),
  
  -- Description
  description TEXT,
  notes TEXT,
  
  -- Posting
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_by UUID REFERENCES users_login(id),
  
  -- Period
  posting_period DATE DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for gl_entries
CREATE INDEX IF NOT EXISTS idx_gl_entries_account_type ON gl_entries(account_type);
CREATE INDEX IF NOT EXISTS idx_gl_entries_reference ON gl_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_posting_period ON gl_entries(posting_period);
CREATE INDEX IF NOT EXISTS idx_gl_entries_posted_at ON gl_entries(posted_at DESC);

-- Settlement Reports Table
CREATE TABLE IF NOT EXISTS settlement_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Report Details
  report_date DATE NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  -- DAILY, WEEKLY, MONTHLY
  
  provider VARCHAR(50) NOT NULL,
  -- RAZORPAY, BANK, PHONEPE, PAYTM
  
  -- Summary
  total_amount DECIMAL(10,2) NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  unmatched_count INTEGER DEFAULT 0,
  
  -- File
  report_file_url TEXT,
  report_file_name VARCHAR(255),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  status VARCHAR(50) DEFAULT 'PROCESSED',
  -- PROCESSED, PENDING, FAILED
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users_login(id)
);

-- Indexes for settlement_reports
CREATE INDEX IF NOT EXISTS idx_settlement_reports_date ON settlement_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_reports_type ON settlement_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_settlement_reports_provider ON settlement_reports(provider);

-- ============================================
-- PHASE 3: PAYOUT ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Payout Reference
  payout_id UUID NOT NULL REFERENCES workshop_payouts(id) ON DELETE CASCADE,
  
  -- Lead/Invoice Reference
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  
  -- Amount Calculation
  invoice_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  
  -- Deductions
  deductions JSONB DEFAULT '{}'::jsonb,
  -- TDS, chargebacks, adjustments
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payout_items
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_lead_id ON payout_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_invoice_id ON payout_items(invoice_id);

-- ============================================
-- PHASE 3: WORKSHOP PAYOUTS ENHANCEMENTS
-- ============================================

ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS payout_batch_id UUID;
ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS csv_file_url TEXT;
ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS supporting_docs JSONB DEFAULT '[]'::jsonb;

-- Add index
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_batch_id ON workshop_payouts(payout_batch_id);

-- ============================================
-- PHASE 4: ARCHIVAL FIELDS
-- ============================================

-- Add archival fields to service_leads
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS archive_checksum VARCHAR(255);

-- Add archival fields to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users_login(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archive_checksum VARCHAR(255);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_read_only ON service_leads(read_only);
CREATE INDEX IF NOT EXISTS idx_service_leads_archived_at ON service_leads(archived_at);
CREATE INDEX IF NOT EXISTS idx_invoices_read_only ON invoices(read_only);
CREATE INDEX IF NOT EXISTS idx_invoices_archived_at ON invoices(archived_at);

-- ============================================
-- PHASE 4: SUPPORT TICKETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  
  -- Ticket Details
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  ticket_type VARCHAR(50) NOT NULL,
  -- DELIVERY_DAMAGE, QUALITY_ISSUE, BILLING_DISPUTE, SERVICE_COMPLAINT, REFUND_REQUEST
  
  severity VARCHAR(50) DEFAULT 'MEDIUM',
  -- LOW, MEDIUM, HIGH, CRITICAL
  
  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'OPEN',
  -- OPEN, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED
  
  -- Assignment
  assigned_to UUID REFERENCES users_login(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Resolution
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  
  -- Escalation
  escalated BOOLEAN DEFAULT false,
  escalated_to UUID REFERENCES users_login(id),
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  
  -- Attachments
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_login(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_lead_id ON support_tickets(lead_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_severity ON support_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);

-- ============================================
-- STEP 13: ENHANCE LEAD_EVENTS TABLE
-- ============================================

-- Add fields to lead_events if not exists
DO $$ 
BEGIN
    -- Check and add actor fields
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_events' AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE lead_events ADD COLUMN actor_id UUID REFERENCES users_login(id);
        ALTER TABLE lead_events ADD COLUMN actor_role VARCHAR(50);
        ALTER TABLE lead_events ADD COLUMN actor_name VARCHAR(255);
        ALTER TABLE lead_events ADD COLUMN ip_address VARCHAR(50);
        ALTER TABLE lead_events ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- ============================================
-- VERIFICATION & SUCCESS MESSAGE
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ALL PHASES DATABASE MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 2 - Delivery & CSE:';
    RAISE NOTICE '  ✓ CSE follow-up fields added';
    RAISE NOTICE '  ✓ Delivery damage tracking added';
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 3 - Reconciliation:';
    RAISE NOTICE '  ✓ recon_exceptions table';
    RAISE NOTICE '  ✓ gl_entries table';
    RAISE NOTICE '  ✓ settlement_reports table';
    RAISE NOTICE '  ✓ payout_items table';
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 4 - Archival:';
    RAISE NOTICE '  ✓ Archival fields added';
    RAISE NOTICE '  ✓ support_tickets table';
    RAISE NOTICE '';
    RAISE NOTICE 'Step 13 - Audit Trail:';
    RAISE NOTICE '  ✓ lead_events enhanced';
    RAISE NOTICE '';
    RAISE NOTICE 'All indexes and comments created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Migration is idempotent - safe to run multiple times.';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================
-- END OF ALL PHASES MIGRATION
-- ============================================

