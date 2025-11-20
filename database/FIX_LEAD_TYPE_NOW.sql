-- ============================================
-- FIX: Ensure lead_type enum exists with NORMAL
-- ============================================

-- Drop and recreate the enum to ensure correct values
DO $$ 
BEGIN
    -- First, temporarily change the column to text
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_leads' 
        AND column_name = 'lead_type'
    ) THEN
        ALTER TABLE public.service_leads 
        ALTER COLUMN lead_type TYPE text;
    END IF;
    
    -- Drop the old enum if it exists
    DROP TYPE IF EXISTS lead_type CASCADE;
    
    -- Create the enum with correct values
    CREATE TYPE lead_type AS ENUM ('NORMAL', 'RSA', 'HOME_SERVICE');
    
    -- Change the column back to enum type
    ALTER TABLE public.service_leads 
    ALTER COLUMN lead_type TYPE lead_type USING lead_type::lead_type;
    
    RAISE NOTICE '✅ lead_type enum fixed! NORMAL is now valid.';
END $$;

-- Verify
SELECT 
    '✅ Valid lead_type values:' AS status,
    e.enumlabel as allowed_values
FROM 
    pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE 
    t.typname = 'lead_type'
ORDER BY 
    e.enumsortorder;

