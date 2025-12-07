-- Migration: Add ON_HOLD status to lead_status enum
-- Purpose: Allow mechanic to put jobs on hold and sync with service_leads status
-- Date: 2025-12-07

-- Add ON_HOLD status if it doesn't exist
DO $$ 
BEGIN
    -- Check if ON_HOLD already exists in lead_status enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'ON_HOLD' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'ON_HOLD';
        RAISE NOTICE '✅ Added ON_HOLD status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ ON_HOLD status already exists in lead_status enum';
    END IF;
END $$;

COMMENT ON TYPE lead_status IS 'Lead status enum - includes ON_HOLD when mechanic puts job on hold';

