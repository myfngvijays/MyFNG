-- =====================================================
-- RENAME VARIANT TO CLASS in car_models
-- Purpose: Change 'variant' column to 'class' as per new requirement
-- =====================================================

DO $$
BEGIN
    -- Check if 'variant' column exists and 'class' does not
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'car_models' 
        AND column_name = 'variant'
    ) THEN
        -- Rename the column
        ALTER TABLE public.car_models RENAME COLUMN variant TO class;
        
        RAISE NOTICE '✅ Renamed column "variant" to "class" in car_models table.';
    ELSE
        RAISE NOTICE '⚠️ Column "variant" not found or "class" already exists. No changes made.';
    END IF;
END $$;

-- Add comment to clarify usage
COMMENT ON COLUMN public.car_models.class IS 'Vehicle Class (e.g., Hatchback, Sedan, SUV) - Previously variant';

