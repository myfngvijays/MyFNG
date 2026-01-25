-- =====================================================
-- 123: mechanic_media_category - add car scanning enums
-- Purpose:
--  - Add new mechanic media categories for car scanning uploads
--  - Required because public.mechanic_media.media_category is an ENUM in some installs
-- =====================================================

DO $$
BEGIN
  -- Only run if the enum type exists (some older installs used varchar instead)
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'mechanic_media_category'
  ) THEN
    -- Add CAR_SCANNING_BEFORE if missing
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'mechanic_media_category'
        AND e.enumlabel = 'CAR_SCANNING_BEFORE'
    ) THEN
      ALTER TYPE mechanic_media_category ADD VALUE 'CAR_SCANNING_BEFORE';
      RAISE NOTICE '✅ Added enum value: CAR_SCANNING_BEFORE';
    ELSE
      RAISE NOTICE 'ℹ️ Enum value already exists: CAR_SCANNING_BEFORE';
    END IF;

    -- Add CAR_SCANNING_AFTER if missing
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'mechanic_media_category'
        AND e.enumlabel = 'CAR_SCANNING_AFTER'
    ) THEN
      ALTER TYPE mechanic_media_category ADD VALUE 'CAR_SCANNING_AFTER';
      RAISE NOTICE '✅ Added enum value: CAR_SCANNING_AFTER';
    ELSE
      RAISE NOTICE 'ℹ️ Enum value already exists: CAR_SCANNING_AFTER';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ mechanic_media_category enum not found; skipping (install likely uses varchar media_category).';
  END IF;
END $$;

