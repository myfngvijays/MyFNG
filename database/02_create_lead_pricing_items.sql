-- =====================================================
-- MIGRATION: Create lead_pricing_items table
-- Purpose: Lock service prices for each lead (immutable pricing snapshot)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_pricing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  
  -- Service/Subservice reference
  service_type_id INTEGER NULL,  -- FK to service_types table (if you have one)
  subservice_id INTEGER NULL,     -- FK to service_subservices table
  
  -- Item details
  item_name VARCHAR(200) NOT NULL,  -- Human readable name
  item_description TEXT,
  
  -- Pricing
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(12,2) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Status
  is_addon BOOLEAN DEFAULT false,  -- True if this is an add-on service
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, CANCELLED, REPLACED
  
  -- Tracking
  added_by UUID REFERENCES public.users_login(id),
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_items_lead_id ON public.lead_pricing_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_service_type ON public.lead_pricing_items(service_type_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_subservice ON public.lead_pricing_items(subservice_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_status ON public.lead_pricing_items(status);

-- Comments
COMMENT ON TABLE public.lead_pricing_items IS 'Immutable pricing snapshot for each lead - used for invoicing and audit';
COMMENT ON COLUMN public.lead_pricing_items.final_price IS 'Final locked price after discount';
COMMENT ON COLUMN public.lead_pricing_items.is_addon IS 'True if this is an additional service added during job';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Lead pricing items table created successfully!';
END $$;

