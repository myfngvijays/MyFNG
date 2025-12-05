-- ================================================================
-- 79_ensure_validation_columns.sql
-- Ensure validation-related columns exist in service_leads
-- Also ensure all required enum values exist
-- Safe to run multiple times
-- ================================================================

DO $$ 
BEGIN
  RAISE NOTICE '🔧 Ensuring validation columns and enum values exist...';
END $$;

-- ================================================================
-- PART 1: Ensure DELIVERED status exists in lead_status enum
-- ================================================================

DO $$ 
BEGIN
  -- Add DELIVERED status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'DELIVERED' 
    AND enumtypid = 'lead_status'::regtype
  ) THEN
    ALTER TYPE lead_status ADD VALUE 'DELIVERED';
    RAISE NOTICE '✅ Added DELIVERED status to lead_status enum';
  ELSE
    RAISE NOTICE '✅ DELIVERED status already exists';
  END IF;
END $$;

-- Add validation columns if they don't exist
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS validated_by_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_incomplete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_leads_validated_by ON public.service_leads(validated_by_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_validated_at ON public.service_leads(validated_at);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_incomplete ON public.service_leads(is_incomplete) WHERE is_incomplete = true;

-- Add comments for documentation
COMMENT ON COLUMN public.service_leads.validated_by_id IS 'Lead Manager who validated this lead';
COMMENT ON COLUMN public.service_leads.validated_at IS 'Timestamp when lead was validated';
COMMENT ON COLUMN public.service_leads.validation_notes IS 'Notes from Lead Manager during validation';
COMMENT ON COLUMN public.service_leads.is_incomplete IS 'Flag indicating if lead is marked as incomplete';
COMMENT ON COLUMN public.service_leads.incomplete_reason IS 'Reason why lead was marked as incomplete';

DO $$ 
BEGIN
  RAISE NOTICE '✅ Validation columns ensured successfully!';
END $$;

