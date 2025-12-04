-- =====================================================
-- MIGRATION: Ensure preferred_date and preferred_time_slot columns exist
-- Purpose: Fix preferred date/time display for pickup boy tasks
-- Date: 2025-12-05
-- =====================================================

-- Add preferred_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'service_leads' 
        AND column_name = 'preferred_date'
    ) THEN
        ALTER TABLE public.service_leads 
        ADD COLUMN preferred_date DATE;
        
        RAISE NOTICE '✅ Added preferred_date column';
    ELSE
        RAISE NOTICE 'ℹ️  preferred_date column already exists';
    END IF;
END $$;

-- Add preferred_time_slot column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'service_leads' 
        AND column_name = 'preferred_time_slot'
    ) THEN
        ALTER TABLE public.service_leads 
        ADD COLUMN preferred_time_slot VARCHAR(50);
        
        RAISE NOTICE '✅ Added preferred_time_slot column';
    ELSE
        RAISE NOTICE 'ℹ️  preferred_time_slot column already exists';
    END IF;
END $$;

-- Also ensure preferred_slot_start and preferred_slot_end exist (alternative format)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'service_leads' 
        AND column_name = 'preferred_slot_start'
    ) THEN
        ALTER TABLE public.service_leads 
        ADD COLUMN preferred_slot_start TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE '✅ Added preferred_slot_start column';
    ELSE
        RAISE NOTICE 'ℹ️  preferred_slot_start column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'service_leads' 
        AND column_name = 'preferred_slot_end'
    ) THEN
        ALTER TABLE public.service_leads 
        ADD COLUMN preferred_slot_end TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE '✅ Added preferred_slot_end column';
    ELSE
        RAISE NOTICE 'ℹ️  preferred_slot_end column already exists';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.service_leads.preferred_date IS 'Customer preferred pickup date (DATE format)';
COMMENT ON COLUMN public.service_leads.preferred_time_slot IS 'Customer preferred time slot (e.g., "Morning", "10:00 AM - 12:00 PM")';
COMMENT ON COLUMN public.service_leads.preferred_slot_start IS 'Customer preferred pickup start time (TIMESTAMP format)';
COMMENT ON COLUMN public.service_leads.preferred_slot_end IS 'Customer preferred pickup end time (TIMESTAMP format)';

DO $$
BEGIN
    RAISE NOTICE '✅ Preferred date/time columns verified!';
    RAISE NOTICE 'ℹ️  The system now supports both formats:';
    RAISE NOTICE '   - preferred_date + preferred_time_slot (DATE + VARCHAR)';
    RAISE NOTICE '   - preferred_slot_start + preferred_slot_end (TIMESTAMP)';
END $$;

