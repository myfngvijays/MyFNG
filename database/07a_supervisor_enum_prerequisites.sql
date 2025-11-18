-- ============================================
-- Workshop Supervisor - Enum Prerequisites
-- RUN THIS FILE FIRST before running 07_workshop_supervisor_enhancements.sql
-- ============================================
-- PostgreSQL requires enum values to be committed before they can be used.
-- This file adds all necessary enum values separately.
-- ============================================

-- 1. Create sla_status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_status') THEN
    CREATE TYPE sla_status AS ENUM ('ON_TIME', 'AT_RISK', 'BREACHED');
    RAISE NOTICE 'Created sla_status enum';
  ELSE
    RAISE NOTICE 'sla_status enum already exists';
  END IF;
END $$;

-- 2. Ensure pickup_task_status exists with ASSIGNED value
DO $$ 
BEGIN
  -- First, check if the enum type exists at all
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickup_task_status') THEN
    -- Create it with all values including ASSIGNED
    CREATE TYPE pickup_task_status AS ENUM ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
    RAISE NOTICE 'Created pickup_task_status enum with all values';
  ELSE
    RAISE NOTICE 'pickup_task_status enum already exists';
    
    -- Check if ASSIGNED value exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'ASSIGNED' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
    ) THEN
      -- Add ASSIGNED value
      ALTER TYPE pickup_task_status ADD VALUE 'ASSIGNED';
      RAISE NOTICE 'Added ASSIGNED to pickup_task_status enum';
    ELSE
      RAISE NOTICE 'ASSIGNED already exists in pickup_task_status enum';
    END IF;
  END IF;
END $$;

-- 3. Ensure all required lead_status values exist
-- Standard values that should exist: NEW, ASSIGNED, ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED
-- New values we're adding: HOLD, READY_FOR_DELIVERY

-- Add REJECTED if missing (should be in base schema but checking)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'REJECTED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'REJECTED';
    RAISE NOTICE 'Added REJECTED to lead_status enum';
  ELSE
    RAISE NOTICE 'REJECTED already exists in lead_status enum';
  END IF;
END $$;

-- Add HOLD to lead_status if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'HOLD' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'HOLD';
    RAISE NOTICE 'Added HOLD to lead_status enum';
  ELSE
    RAISE NOTICE 'HOLD already exists in lead_status enum';
  END IF;
END $$;

-- Add READY_FOR_DELIVERY to lead_status if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'READY_FOR_DELIVERY' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'READY_FOR_DELIVERY';
    RAISE NOTICE 'Added READY_FOR_DELIVERY to lead_status enum';
  ELSE
    RAISE NOTICE 'READY_FOR_DELIVERY already exists in lead_status enum';
  END IF;
END $$;

-- ============================================
-- VERIFICATION - Show all enum values
-- ============================================

-- List all values in each enum
DO $$
DECLARE
  enum_count INT;
  enum_rec RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ENUM VERIFICATION';
  RAISE NOTICE '============================================';
  
  -- Check lead_status
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status');
  RAISE NOTICE 'lead_status enum has % values:', enum_count;
  
  FOR enum_rec IN 
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ORDER BY enumsortorder
  LOOP
    RAISE NOTICE '  - %', enum_rec.enumlabel;
  END LOOP;
  
  -- Check sla_status
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sla_status');
  RAISE NOTICE 'sla_status enum has % values:', enum_count;
  
  FOR enum_rec IN 
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sla_status')
    ORDER BY enumsortorder
  LOOP
    RAISE NOTICE '  - %', enum_rec.enumlabel;
  END LOOP;
  
  -- Check pickup_task_status
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status');
  RAISE NOTICE 'pickup_task_status enum has % values:', enum_count;
  
  FOR enum_rec IN 
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
    ORDER BY enumsortorder
  LOOP
    RAISE NOTICE '  - %', enum_rec.enumlabel;
  END LOOP;
  
  RAISE NOTICE '============================================';
  
  -- Verify ASSIGNED exists
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ASSIGNED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
  ) THEN
    RAISE NOTICE '✅ VERIFIED: ASSIGNED exists in pickup_task_status';
  ELSE
    RAISE WARNING '❌ ERROR: ASSIGNED is MISSING from pickup_task_status!';
  END IF;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'All enum prerequisites completed successfully!' AS status;
SELECT 'You can now run 07_workshop_supervisor_enhancements.sql' AS next_step;

