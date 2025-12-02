-- =====================================================
-- ADD VARIANT COLUMN TO CAR_MODELS
-- Purpose: Add variant column for vehicle variant (e.g. VXI, ZXI)
-- =====================================================

-- Add variant column if it doesn't exist
ALTER TABLE public.car_models 
ADD COLUMN IF NOT EXISTS variant VARCHAR(100);

-- Add comment
COMMENT ON COLUMN public.car_models.variant IS 'Vehicle Variant (e.g. VXI, ZXI, LXI). Different from class which is vehicle category (SUV, Sedan, etc.)';

DO $$
BEGIN
    RAISE NOTICE '✅ Variant column added to car_models table!';
END $$;

