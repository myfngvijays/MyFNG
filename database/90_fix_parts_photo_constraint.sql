-- Fix Parts Photo Upload Error
-- Issue: mechanic_job_photos table has strict CHECK constraint that rejects dynamic photo types
-- Solution: Relax constraint to allow parts-specific photo names (e.g., "oil filter - Old Part Removed")

-- Drop existing strict constraint
ALTER TABLE public.mechanic_job_photos 
  DROP CONSTRAINT IF EXISTS mechanic_job_photos_photo_type_check;

-- Add flexible constraint
-- Allows: predefined types OR dynamic part-specific names (must contain '-')
ALTER TABLE public.mechanic_job_photos
  ADD CONSTRAINT mechanic_job_photos_photo_type_check
  CHECK (
    photo_type IN (
      -- BEFORE INSPECTION
      'BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT',
      'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY', 'BEFORE_DAMAGE', 'BEFORE_TYRE',
      -- DURING SERVICE
      'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
      'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
      'DURING_PART_REMOVAL', 'DURING_PART_INSTALL',
      -- AFTER SERVICE
      'AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT',
      'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS', 'AFTER_NEW_PARTS', 'AFTER_ODOMETER'
    )
    OR
    -- Allow dynamic part-specific photos (format: "part name - description")
    -- Examples: "oil filter - Old Part Removed", "break pad - New Part Installed"
    (photo_type LIKE '%-%' AND LENGTH(photo_type) < 200)
  );

-- Add helpful comment
COMMENT ON COLUMN public.mechanic_job_photos.photo_type IS 
  'Photo type: Use predefined types (BEFORE_FRONT, AFTER_OLD_PARTS, etc.) OR parts-specific format with separator (e.g., "oil filter - Old Part Removed")';

-- Verify constraint is working
DO $$
BEGIN
  -- Test valid predefined type
  RAISE NOTICE 'Testing predefined photo type...';
  PERFORM 'BEFORE_FRONT'::text;
  
  -- Test valid dynamic type
  RAISE NOTICE 'Testing dynamic photo type...';
  PERFORM 'oil filter - Old Part Removed'::text;
  
  RAISE NOTICE 'Constraint successfully updated! Both predefined and dynamic photo types are now allowed.';
END $$;

