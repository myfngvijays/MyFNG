-- ============================================
-- Quick Diagnostic: Check Current Enum Status
-- Run this to see what's in your database right now
-- ============================================

-- Check if pickup_task_status enum exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickup_task_status') 
    THEN '✅ pickup_task_status enum EXISTS'
    ELSE '❌ pickup_task_status enum DOES NOT EXIST'
  END AS status;

-- List all values in pickup_task_status (if it exists)
SELECT 
  enumlabel as value,
  enumsortorder as order_num
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
ORDER BY enumsortorder;

-- Check if ASSIGNED exists in pickup_task_status
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'ASSIGNED' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pickup_task_status')
    )
    THEN '✅ ASSIGNED exists in pickup_task_status'
    ELSE '❌ ASSIGNED is MISSING from pickup_task_status'
  END AS assigned_status;

-- Check lead_status enum values
SELECT 
  'lead_status' as enum_name,
  enumlabel as value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
ORDER BY enumsortorder;

-- Check if HOLD and READY_FOR_DELIVERY exist
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'HOLD' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    )
    THEN '✅ HOLD exists'
    ELSE '❌ HOLD missing'
  END AS hold_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'READY_FOR_DELIVERY' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    )
    THEN '✅ READY_FOR_DELIVERY exists'
    ELSE '❌ READY_FOR_DELIVERY missing'
  END AS ready_for_delivery_status;

