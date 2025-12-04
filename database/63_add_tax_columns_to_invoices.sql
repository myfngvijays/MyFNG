-- Migration: Add tax columns to invoices table
-- Purpose: Add CGST, SGST, IGST tax columns to invoices table

-- Add tax columns if they don't exist
DO $$ 
BEGIN
    -- CGST columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'cgst_percentage') THEN
        ALTER TABLE invoices ADD COLUMN cgst_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'cgst_amount') THEN
        ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- SGST columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'sgst_percentage') THEN
        ALTER TABLE invoices ADD COLUMN sgst_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'sgst_amount') THEN
        ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- IGST columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'igst_percentage') THEN
        ALTER TABLE invoices ADD COLUMN igst_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'igst_amount') THEN
        ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Total tax column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'total_tax') THEN
        ALTER TABLE invoices ADD COLUMN total_tax DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    RAISE NOTICE '✅ Tax columns added to invoices table';
END $$;

