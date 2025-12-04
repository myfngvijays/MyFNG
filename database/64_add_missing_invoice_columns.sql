-- Migration: Add missing columns to invoices table
-- Purpose: Add sub_total, final_amount, parts_cost, labour_cost columns

DO $$ 
BEGIN
    -- Add sub_total column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'sub_total') THEN
        ALTER TABLE invoices ADD COLUMN sub_total DECIMAL(10,2);
        -- Calculate sub_total from existing data
        UPDATE invoices 
        SET sub_total = COALESCE(base_amount, 0) + COALESCE(extra_charges, 0) - COALESCE(discount, 0);
    END IF;
    
    -- Add final_amount column (alias for total_amount)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'final_amount') THEN
        ALTER TABLE invoices ADD COLUMN final_amount DECIMAL(10,2);
        -- Copy from total_amount
        UPDATE invoices SET final_amount = total_amount;
    END IF;
    
    -- Add parts_cost column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'parts_cost') THEN
        ALTER TABLE invoices ADD COLUMN parts_cost DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add labour_cost column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'labour_cost') THEN
        ALTER TABLE invoices ADD COLUMN labour_cost DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    RAISE NOTICE '✅ Missing columns added to invoices table';
END $$;

