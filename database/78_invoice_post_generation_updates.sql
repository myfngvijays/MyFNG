-- ============================================
-- INVOICE POST-GENERATION UPDATES
-- Date: Based on Invoice + Payment Flow Document
-- Purpose: Add missing fields and ensure proper workflow
-- ============================================

-- ============================================
-- STEP 1: Add job card locking fields
-- ============================================

-- Add locked_at timestamp to job_cards if not exists
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users_login(id);
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Add index for locked job cards
CREATE INDEX IF NOT EXISTS idx_job_cards_locked_at ON job_cards(locked_at) WHERE locked_at IS NOT NULL;

-- ============================================
-- STEP 2: Add receipt fields to invoices
-- ============================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- STEP 3: Add cash deposit tracking to payment_transactions
-- ============================================

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS cash_collected BOOLEAN DEFAULT false;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS cash_deposit_pending BOOLEAN DEFAULT false;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS bank_deposit_slip_url TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS deposit_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS deposit_confirmed_by UUID REFERENCES users_login(id);

-- ============================================
-- STEP 4: Add CSAT and CSE follow-up fields to service_leads
-- ============================================

ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS csat_rating INTEGER CHECK (csat_rating >= 1 AND csat_rating <= 5);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS csat_feedback TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_due BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_due_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_notes TEXT;

-- Add index for CSE follow-up queue
CREATE INDEX IF NOT EXISTS idx_service_leads_cse_followup_due ON service_leads(cse_followup_due, cse_followup_due_at) WHERE cse_followup_due = true;

-- ============================================
-- STEP 5: Add archive and read-only fields
-- ============================================

ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS retention_period_years INTEGER DEFAULT 7;

-- Add index for archived leads
CREATE INDEX IF NOT EXISTS idx_service_leads_archived ON service_leads(archived_at) WHERE archived_at IS NOT NULL;

-- ============================================
-- STEP 6: Add send_failures tracking to invoices
-- ============================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_failures JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_to_customer_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- STEP 7: Add function to auto-set CSE follow-up due date
-- ============================================

CREATE OR REPLACE FUNCTION set_cse_followup_due()
RETURNS TRIGGER AS $$
BEGIN
    -- Set CSE follow-up due when lead is DELIVERED
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
        NEW.cse_followup_due := true;
        NEW.cse_followup_due_at := NOW() + INTERVAL '24 hours';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_set_cse_followup_due ON service_leads;
CREATE TRIGGER trigger_set_cse_followup_due
    BEFORE UPDATE ON service_leads
    FOR EACH ROW
    EXECUTE FUNCTION set_cse_followup_due();

-- ============================================
-- STEP 8: Verification
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Invoice post-generation updates completed!';
    RAISE NOTICE 'Added fields: job_cards.locked_at, invoices.receipt_url, payment_transactions.cash_deposit_pending, service_leads.csat_rating, service_leads.read_only';
    RAISE NOTICE 'Created trigger: trigger_set_cse_followup_due';
END $$;

