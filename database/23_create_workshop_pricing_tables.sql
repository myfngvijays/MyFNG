-- =====================================================
-- MIGRATION: Create workshop pricing tables
-- Purpose: Store workshop-specific pricing for service types and addons
-- =====================================================

-- =====================================================
-- 1. Workshop Service Type Pricing Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workshop_service_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  custom_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workshop_id, service_type_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_workshop_id ON public.workshop_service_pricing(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_service_type_id ON public.workshop_service_pricing(service_type_id);
CREATE INDEX IF NOT EXISTS idx_workshop_service_pricing_active ON public.workshop_service_pricing(is_active);

-- Comments
COMMENT ON TABLE public.workshop_service_pricing IS 'Workshop-specific pricing for service types';
COMMENT ON COLUMN public.workshop_service_pricing.custom_price IS 'Custom price set by workshop (overrides default if set)';

-- =====================================================
-- 2. Workshop Service Addon Pricing Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workshop_service_addons_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  service_addon_id UUID NOT NULL REFERENCES public.service_addons(id) ON DELETE CASCADE,
  custom_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workshop_id, service_addon_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workshop_addons_pricing_workshop_id ON public.workshop_service_addons_pricing(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_addons_pricing_addon_id ON public.workshop_service_addons_pricing(service_addon_id);
CREATE INDEX IF NOT EXISTS idx_workshop_addons_pricing_active ON public.workshop_service_addons_pricing(is_active);

-- Comments
COMMENT ON TABLE public.workshop_service_addons_pricing IS 'Workshop-specific pricing for service addons';
COMMENT ON COLUMN public.workshop_service_addons_pricing.custom_price IS 'Custom price set by workshop (overrides default if set)';

-- =====================================================
-- 3. Update trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_workshop_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workshop_service_pricing_updated_at
  BEFORE UPDATE ON public.workshop_service_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_workshop_pricing_updated_at();

CREATE TRIGGER update_workshop_addons_pricing_updated_at
  BEFORE UPDATE ON public.workshop_service_addons_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_workshop_pricing_updated_at();

