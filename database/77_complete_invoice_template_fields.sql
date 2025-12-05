-- ============================================
-- COMPLETE INVOICE TEMPLATE FIELDS MIGRATION
-- Date: Based on Invoice + Payment Flow Document
-- Purpose: Add all missing fields from professional invoice template
-- ============================================

-- ============================================
-- STEP 1: Add missing fields to invoices table
-- ============================================

-- Jobcard ID link
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS jobcard_id UUID REFERENCES job_cards(id);

-- Due date (calculated as 7 days from invoice date, or custom)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100) DEFAULT 'Due on Receipt';

-- Round off amount (already calculated but need to store separately)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS round_off_amount DECIMAL(10,2) DEFAULT 0;

-- Old parts handed over
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS old_parts_handed_over BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS old_parts_handed_over_notes TEXT;

-- Warranty information
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS warranty_info JSONB DEFAULT '{}'::jsonb;
-- Format: {"labour_warranty": "1 month / 1,000 km", "parts_warranty": "6 months", "notes": "..."}

-- Customer address fields (for invoice display)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_state VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_pincode VARCHAR(10);

-- Invoice notes/remarks (general)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recommended_future_work TEXT;

-- Bank details (can be stored per workshop, but also in invoice for reference)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);

-- Invoice date & time (separate from created_at for better control)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_time TIME;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_jobcard_id ON invoices(jobcard_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================
-- STEP 2: Update invoice generation to calculate due_date
-- ============================================

-- Function to auto-calculate due_date when invoice is created
CREATE OR REPLACE FUNCTION calculate_invoice_due_date()
RETURNS TRIGGER AS $$
BEGIN
    -- If due_date is not set, calculate as 7 days from invoice_date or created_at
    IF NEW.due_date IS NULL THEN
        IF NEW.invoice_date IS NOT NULL THEN
            NEW.due_date := NEW.invoice_date + INTERVAL '7 days';
        ELSE
            NEW.due_date := (NEW.created_at::DATE) + INTERVAL '7 days';
        END IF;
    END IF;
    
    -- Set invoice_date if not set
    IF NEW.invoice_date IS NULL THEN
        NEW.invoice_date := NEW.created_at::DATE;
    END IF;
    
    -- Set invoice_time if not set
    IF NEW.invoice_time IS NULL THEN
        NEW.invoice_time := NEW.created_at::TIME;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_calculate_invoice_due_date ON invoices;
CREATE TRIGGER trigger_calculate_invoice_due_date
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.due_date IS NULL OR NEW.invoice_date IS NULL OR NEW.invoice_time IS NULL)
    EXECUTE FUNCTION calculate_invoice_due_date();

-- ============================================
-- STEP 3: Add bank details to workshops table (if not exists)
-- ============================================

ALTER TABLE workshops ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);

-- ============================================
-- STEP 4: Add warranty fields to job_cards table (if needed)
-- ============================================

ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS warranty_labour_period VARCHAR(100) DEFAULT '1 month / 1,000 km';
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS warranty_parts_period VARCHAR(100) DEFAULT '6 months';
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

-- ============================================
-- STEP 5: Verification
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Invoice template fields migration completed!';
    RAISE NOTICE 'Added fields: jobcard_id, due_date, payment_terms, round_off_amount, old_parts_handed_over, warranty_info, customer_address, bank_details, invoice_notes';
    RAISE NOTICE 'Created trigger: trigger_calculate_invoice_due_date';
    RAISE NOTICE 'Updated tables: invoices, workshops, job_cards';
END $$;

