-- Add VEHICLE_DROPPED_AT_WORKSHOP status to lead_status enum
-- Purpose: When pickup boy delivers car to workshop, status should be VEHICLE_DROPPED_AT_WORKSHOP instead of COMPLETED

DO $$ 
BEGIN
    -- Check if VEHICLE_DROPPED_AT_WORKSHOP status exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'VEHICLE_DROPPED_AT_WORKSHOP' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VEHICLE_DROPPED_AT_WORKSHOP';
        RAISE NOTICE '✅ Added VEHICLE_DROPPED_AT_WORKSHOP status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ VEHICLE_DROPPED_AT_WORKSHOP status already exists in lead_status enum';
    END IF;
END $$;

