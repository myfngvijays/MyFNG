-- ============================================
-- Add ON_THE_WAY status to lead_status enum
-- Purpose: Support pickup boy navigation status
-- ============================================

DO $$ 
BEGIN
    -- Check if ON_THE_WAY already exists in lead_status enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'ON_THE_WAY' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'ON_THE_WAY';
        RAISE NOTICE '✅ Added ON_THE_WAY status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ ON_THE_WAY status already exists in lead_status enum';
    END IF;
END $$;

COMMENT ON TYPE lead_status IS 'Lead status enum - includes ON_THE_WAY for pickup boy navigation';

