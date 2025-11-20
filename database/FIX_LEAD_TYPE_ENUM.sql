-- ============================================
-- FIX lead_type ENUM - Add NORMAL value
-- ============================================
-- This will create the enum if it doesn't exist,
-- or add NORMAL to it if it does exist

-- Step 1: Check if lead_type enum exists
DO $$ 
BEGIN
    -- If lead_type enum doesn't exist, create it
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_type') THEN
        CREATE TYPE lead_type AS ENUM (
            'NORMAL',
            'EMERGENCY',
            'URGENT',
            'REGULAR',
            'PREMIUM',
            'STANDARD'
        );
        RAISE NOTICE 'Created lead_type enum with NORMAL value';
    ELSE
        -- If it exists, try to add NORMAL value (if not already present)
        BEGIN
            ALTER TYPE lead_type ADD VALUE IF NOT EXISTS 'NORMAL';
            RAISE NOTICE 'Added NORMAL to lead_type enum';
        EXCEPTION 
            WHEN duplicate_object THEN 
                RAISE NOTICE 'NORMAL already exists in lead_type enum';
        END;
    END IF;
END $$;

-- Step 2: Verify the enum values
SELECT 
    'lead_type enum values:' AS info,
    e.enumlabel as allowed_values
FROM 
    pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE 
    t.typname = 'lead_type'
ORDER BY 
    e.enumsortorder;

-- ============================================
-- ✅ DONE! Now "NORMAL" is a valid lead_type
-- ============================================

