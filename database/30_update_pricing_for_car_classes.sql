-- =====================================================
-- UPDATE PRICING FOR CAR CLASSES
-- Purpose: Enable class-based pricing (e.g. SUV vs Hatchback) for products/services
-- =====================================================

-- 1. Add 'class' column to workshop_product_pricing
ALTER TABLE public.workshop_product_pricing 
ADD COLUMN IF NOT EXISTS class VARCHAR(100);

-- 2. Drop old unique constraint
ALTER TABLE public.workshop_product_pricing 
DROP CONSTRAINT IF EXISTS workshop_product_pricing_workshop_id_product_id_key;

-- 3. Add new unique constraint including class
-- Using NULLs NOT DISTINCT mechanism (Postgres 15+) or standard unique index
-- For wider compatibility, we use a unique index that allows multiple NULLs logic 
-- but here we want ONLY ONE entry per (workshop, product, class-or-null).
-- Postgres treats NULL != NULL in unique constraints usually, but we want to enforce uniqueness.

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_workshop_product_class 
ON public.workshop_product_pricing (workshop_id, product_id, COALESCE(class, 'DEFAULT'));

-- 4. Add comment
COMMENT ON COLUMN public.workshop_product_pricing.class IS 'Vehicle Class (e.g. SUV, Sedan). If NULL, applies to all classes.';

-- 5. Update Master Products to support Class-Based Flag (Optional but helpful)
ALTER TABLE public.master_products
ADD COLUMN IF NOT EXISTS is_class_dependent BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.master_products.is_class_dependent IS 'If true, UI should prompt for class-wise pricing';

DO $$
BEGIN
    RAISE NOTICE '✅ Updated pricing tables to support Car Classes!';
END $$;

