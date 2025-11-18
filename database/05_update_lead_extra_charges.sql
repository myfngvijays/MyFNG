-- =====================================================
-- MIGRATION: Update lead_extra_charges table
-- Purpose: Track all extra charges requested during service
-- =====================================================

-- Add missing columns to existing lead_extra_charges table
DO $$ 
BEGIN
  -- Add attachment/evidence URL if using different column name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN attachment_url TEXT;
  END IF;
  
  -- Add category for grouping charges
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN category VARCHAR(50);
  END IF;
  
  -- Add rejection reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN rejection_reason TEXT;
  END IF;
  
  -- Add customer approval fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'customer_approved'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN customer_approved BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'customer_approved_at'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN customer_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add priority flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'is_urgent'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN is_urgent BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Rename image_url to attachment_url if it exists with old name
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'image_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_extra_charges' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE public.lead_extra_charges RENAME COLUMN image_url TO attachment_url;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_extra_charges_lead_id ON public.lead_extra_charges(lead_id);
CREATE INDEX IF NOT EXISTS idx_extra_charges_status ON public.lead_extra_charges(status);
CREATE INDEX IF NOT EXISTS idx_extra_charges_category ON public.lead_extra_charges(category);
CREATE INDEX IF NOT EXISTS idx_extra_charges_requested_by ON public.lead_extra_charges(requested_by);
CREATE INDEX IF NOT EXISTS idx_extra_charges_approved_by ON public.lead_extra_charges(approved_by);
CREATE INDEX IF NOT EXISTS idx_extra_charges_supervisor ON public.lead_extra_charges(supervisor_approved_by);
CREATE INDEX IF NOT EXISTS idx_extra_charges_urgent ON public.lead_extra_charges(is_urgent) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_extra_charges_created ON public.lead_extra_charges(created_at DESC);

-- Comments
COMMENT ON TABLE public.lead_extra_charges IS 'Extra charges requested during service (requires approval)';
COMMENT ON COLUMN public.lead_extra_charges.status IS 'Status: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN public.lead_extra_charges.category IS 'Category: PARTS, LABOR, CONSUMABLES, EMERGENCY, OTHER';
COMMENT ON COLUMN public.lead_extra_charges.attachment_url IS 'Photo/document evidence for the extra charge';
COMMENT ON COLUMN public.lead_extra_charges.customer_approved IS 'Whether customer has approved this charge';
COMMENT ON COLUMN public.lead_extra_charges.is_urgent IS 'Flag for urgent approval required';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Lead extra charges table updated successfully!';
END $$;

