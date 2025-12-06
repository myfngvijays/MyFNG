-- ============================================
-- Add missing pickup-related statuses to lead_status enum
-- Purpose: Support complete pickup workflow statuses
-- ============================================

DO $$ 
BEGIN
    -- Add VEHICLE_IN_TRANSIT status
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'VEHICLE_IN_TRANSIT' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VEHICLE_IN_TRANSIT';
        RAISE NOTICE '✅ Added VEHICLE_IN_TRANSIT status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ VEHICLE_IN_TRANSIT status already exists in lead_status enum';
    END IF;

    -- Add VEHICLE_DROPPED_AT_WORKSHOP status
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'VEHICLE_DROPPED_AT_WORKSHOP' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VEHICLE_DROPPED_AT_WORKSHOP';
        RAISE NOTICE '✅ Added VEHICLE_DROPPED_AT_WORKSHOP status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ VEHICLE_DROPPED_AT_WORKSHOP status already exists in lead_status enum';
    END IF;

    -- Ensure ON_THE_WAY status exists (in case migration 81 wasn't run)
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

COMMENT ON TYPE lead_status IS 'Lead status enum - includes pickup workflow statuses: ON_THE_WAY, VEHICLE_IN_TRANSIT, VEHICLE_DROPPED_AT_WORKSHOP';

