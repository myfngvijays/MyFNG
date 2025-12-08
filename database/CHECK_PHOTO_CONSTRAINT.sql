-- Check current constraint on mechanic_job_photos.photo_type
-- Run this to see if migration 90 was applied correctly

-- 1. Check constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'mechanic_job_photos'::regclass
  AND conname LIKE '%photo_type%';

-- 2. Check table columns
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mechanic_job_photos'
  AND column_name = 'photo_type';

-- 3. Test if dynamic photo types are allowed (read-only test)
-- This will show if the constraint would allow dynamic types
SELECT 
    'oil filter - Old Part Removed' AS test_photo_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'mechanic_job_photos'::regclass
              AND conname LIKE '%photo_type%'
              AND (pg_get_constraintdef(oid) LIKE '%~~%' OR pg_get_constraintdef(oid) LIKE '%LIKE%')
        ) 
        THEN '✅ Dynamic types ALLOWED (constraint has ~~ or LIKE pattern)'
        ELSE '❌ Dynamic types BLOCKED (constraint is strict)'
    END AS constraint_status;

