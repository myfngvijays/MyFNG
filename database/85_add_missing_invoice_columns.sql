-- ============================================
-- ADD MISSING INVOICE COLUMNS
-- Date: Based on generate-invoice API requirements
-- Purpose: Add all columns that are missing from invoices table
-- ============================================

-- Amount in words (critical - currently missing)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_in_words TEXT;

-- Place of supply fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply_state_code VARCHAR(10);

-- Line items and HSN/SAC codes (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hsn_sac_codes JSONB DEFAULT '[]'::jsonb;

-- Customer address fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_state VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_pincode VARCHAR(10);

-- Bank details (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);

-- Warranty info (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS warranty_info JSONB DEFAULT '{}'::jsonb;

-- Invoice date and time (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_time TIME;

-- Round off amount (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS round_off_amount DECIMAL(10,2) DEFAULT 0;

-- Old parts handed over (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS old_parts_handed_over BOOLEAN DEFAULT false;

-- Jobcard ID (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS jobcard_id UUID REFERENCES job_cards(id);

-- Due date and payment terms (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100) DEFAULT 'Due on Receipt';

-- Discount fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- Tax fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_tax DECIMAL(10,2) DEFAULT 0;

-- Amount fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS extra_charges DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parts_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS labour_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sub_total DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);

-- Handle total_amount column (might have NOT NULL constraint)
DO $$ 
BEGIN
    -- Add total_amount if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices' 
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN total_amount DECIMAL(10,2);
    END IF;
    
    -- Update existing rows to set total_amount = final_amount if it's NULL
    UPDATE invoices SET total_amount = COALESCE(final_amount, 0) WHERE total_amount IS NULL;
    
    -- If total_amount has NOT NULL constraint, set a default value for new inserts
    -- We'll use a trigger or default value
    BEGIN
        ALTER TABLE invoices ALTER COLUMN total_amount SET DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN
        -- Column might already have a default or constraint, ignore
        NULL;
    END;
END $$;

-- Status and payment fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'GENERATED';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';

-- Audit fields (if not already added)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users_login(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- ADD MISSING WORKSHOPS COLUMNS
-- ============================================

-- State code for workshops (if not already added)
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);

-- ============================================
-- VERIFICATION
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Missing invoice columns migration completed!';
    RAISE NOTICE 'Added invoice columns: amount_in_words, place_of_supply, line_items, hsn_sac_codes, customer_address fields, bank_details, warranty_info, invoice_date, invoice_time, round_off_amount, old_parts_handed_over, jobcard_id, due_date, payment_terms, coupon_code, discount fields, tax fields, amount fields, status fields';
    RAISE NOTICE 'Added workshops column: state_code';
END $$;

