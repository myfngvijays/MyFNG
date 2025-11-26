-- ============================================
-- PHASE 1: INVOICE TABLE ENHANCEMENTS
-- Purpose: Add missing fields for invoice flow
-- Date: November 26, 2025
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_requires_second_approval ON invoices(requires_second_approval);
CREATE INDEX IF NOT EXISTS idx_invoices_balance_due ON invoices(balance_due);

-- Comments
COMMENT ON COLUMN invoices.send_failures IS 'Array of failed send attempts with error details';
COMMENT ON COLUMN invoices.balance_due IS 'Remaining amount due after partial payments';
COMMENT ON COLUMN invoices.requires_second_approval IS 'Whether invoice requires Finance Manager approval';
COMMENT ON COLUMN invoices.customer_gstin IS 'Customer GSTIN for B2B transactions';

