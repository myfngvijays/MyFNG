-- ============================================
-- FIX ALL ENUM ISSUES AT ONCE
-- Run this ONE file to add ALL missing enum values
-- ============================================

-- Show current state BEFORE fixes
DO $$
DECLARE
  enum_rec RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'CURRENT lead_status ENUM VALUES:';
  RAISE NOTICE '============================================';
  
  FOR enum_rec IN 
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ORDER BY enumsortorder
  LOOP
    RAISE NOTICE '  ✓ %', enum_rec.enumlabel;
  END LOOP;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- Add ALL missing enum values
-- ============================================

-- 1. Create sla_status if doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_status') THEN
    CREATE TYPE sla_status AS ENUM ('ON_TIME', 'AT_RISK', 'BREACHED');
    RAISE NOTICE '✅ Created sla_status enum';
  ELSE
    RAISE NOTICE '✓ sla_status enum already exists';
  END IF;
END $$;

-- 2. Ensure pickup_task_status has ASSIGNED
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickup_task_status') THEN
    CREATE TYPE pickup_task_status AS ENUM ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
    RAISE NOTICE '✅ Created pickup_task_status enum';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'ASSIGNED' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
    ) THEN
      ALTER TYPE pickup_task_status ADD VALUE 'ASSIGNED';
      RAISE NOTICE '✅ Added ASSIGNED to pickup_task_status';
    ELSE
      RAISE NOTICE '✓ ASSIGNED already in pickup_task_status';
    END IF;
  END IF;
END $$;

-- 3. Add NEW to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'NEW' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'NEW';
    RAISE NOTICE '✅ Added NEW to lead_status';
  ELSE
    RAISE NOTICE '✓ NEW already in lead_status';
  END IF;
END $$;

-- 4. Add ASSIGNED to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ASSIGNED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'ASSIGNED';
    RAISE NOTICE '✅ Added ASSIGNED to lead_status';
  ELSE
    RAISE NOTICE '✓ ASSIGNED already in lead_status';
  END IF;
END $$;

-- 5. Add ACCEPTED to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ACCEPTED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'ACCEPTED';
    RAISE NOTICE '✅ Added ACCEPTED to lead_status';
  ELSE
    RAISE NOTICE '✓ ACCEPTED already in lead_status';
  END IF;
END $$;

-- 6. Add REJECTED to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'REJECTED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'REJECTED';
    RAISE NOTICE '✅ Added REJECTED to lead_status';
  ELSE
    RAISE NOTICE '✓ REJECTED already in lead_status';
  END IF;
END $$;

-- 7. Add IN_PROGRESS to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'IN_PROGRESS' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'IN_PROGRESS';
    RAISE NOTICE '✅ Added IN_PROGRESS to lead_status';
  ELSE
    RAISE NOTICE '✓ IN_PROGRESS already in lead_status';
  END IF;
END $$;

-- 8. Add COMPLETED to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'COMPLETED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'COMPLETED';
    RAISE NOTICE '✅ Added COMPLETED to lead_status';
  ELSE
    RAISE NOTICE '✓ COMPLETED already in lead_status';
  END IF;
END $$;

-- 9. Add CANCELLED to lead_status if missing (base value)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'CANCELLED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'CANCELLED';
    RAISE NOTICE '✅ Added CANCELLED to lead_status';
  ELSE
    RAISE NOTICE '✓ CANCELLED already in lead_status';
  END IF;
END $$;

-- 10. Add HOLD to lead_status (NEW value for supervisor)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'HOLD' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'HOLD';
    RAISE NOTICE '✅ Added HOLD to lead_status (NEW!)';
  ELSE
    RAISE NOTICE '✓ HOLD already in lead_status';
  END IF;
END $$;

-- 11. Add READY_FOR_DELIVERY to lead_status (NEW value for supervisor)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'READY_FOR_DELIVERY' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'READY_FOR_DELIVERY';
    RAISE NOTICE '✅ Added READY_FOR_DELIVERY to lead_status (NEW!)';
  ELSE
    RAISE NOTICE '✓ READY_FOR_DELIVERY already in lead_status';
  END IF;
END $$;

-- ============================================
-- FINAL VERIFICATION
-- ============================================

DO $$
DECLARE
  enum_rec RECORD;
  required_values TEXT[] := ARRAY['NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD', 'READY_FOR_DELIVERY'];
  val TEXT;
  missing_count INT := 0;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'FINAL lead_status ENUM VALUES:';
  RAISE NOTICE '============================================';
  
  FOR enum_rec IN 
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ORDER BY enumsortorder
  LOOP
    RAISE NOTICE '  ✅ %', enum_rec.enumlabel;
  END LOOP;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'CHECKING REQUIRED VALUES:';
  RAISE NOTICE '============================================';
  
  FOREACH val IN ARRAY required_values LOOP
    IF EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = val 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
      RAISE NOTICE '  ✅ % exists', val;
    ELSE
      RAISE WARNING '  ❌ % is MISSING!', val;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '============================================';
  
  IF missing_count = 0 THEN
    RAISE NOTICE '🎉 SUCCESS! All required enum values exist!';
    RAISE NOTICE 'You can now run: 07_workshop_supervisor_enhancements.sql';
  ELSE
    RAISE WARNING '⚠️  % values are still missing! Run this file again!', missing_count;
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

