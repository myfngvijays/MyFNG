-- =====================================================
-- CREATE WEBSITE SERVICE PRICING TABLE
-- Purpose: Super Admin can manage customer-facing service prices
-- Based on: Zone + City + Service Type
-- =====================================================

-- =====================================================
-- 1. Create WEBSITE_SERVICE_PRICING Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.website_service_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Zone and City mapping
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  
  -- Service reference
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  
  -- Pricing
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  final_price NUMERIC(12,2) GENERATED ALWAYS AS (base_price + (base_price * tax_rate / 100)) STORED,
  
  -- Vehicle class (optional - for class-based pricing)
  vehicle_class VARCHAR(50), -- HATCHBACK, SEDAN, SUV, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES public.users_login(id),
  updated_by UUID REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- 2. Create Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_website_pricing_zone ON public.website_service_pricing(zone_id);
CREATE INDEX IF NOT EXISTS idx_website_pricing_city ON public.website_service_pricing(city_id);
CREATE INDEX IF NOT EXISTS idx_website_pricing_service ON public.website_service_pricing(service_type_id);
CREATE INDEX IF NOT EXISTS idx_website_pricing_zone_city ON public.website_service_pricing(zone_id, city_id);
CREATE INDEX IF NOT EXISTS idx_website_pricing_active ON public.website_service_pricing(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_website_pricing_class ON public.website_service_pricing(vehicle_class) WHERE vehicle_class IS NOT NULL;

-- Unique index: One price per zone-city-service-class combination
-- Handles NULL vehicle_class by treating it as empty string for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_website_pricing 
ON public.website_service_pricing(zone_id, city_id, service_type_id, COALESCE(vehicle_class, ''));

-- =====================================================
-- 3. Enable Row Level Security
-- =====================================================
ALTER TABLE public.website_service_pricing ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Everyone can view active website pricing" ON public.website_service_pricing;
DROP POLICY IF EXISTS "Authenticated users can view all pricing" ON public.website_service_pricing;
DROP POLICY IF EXISTS "Super Admin can manage website pricing" ON public.website_service_pricing;
DROP POLICY IF EXISTS "Super Admin can insert pricing" ON public.website_service_pricing;
DROP POLICY IF EXISTS "Super Admin can update pricing" ON public.website_service_pricing;
DROP POLICY IF EXISTS "Super Admin can delete pricing" ON public.website_service_pricing;

-- Policy: Everyone can view active pricing (public access)
CREATE POLICY "Everyone can view active website pricing" 
ON public.website_service_pricing 
FOR SELECT 
USING (is_active = true);

-- Policy: Authenticated users can view all pricing (for admin dashboard)
CREATE POLICY "Authenticated users can view all pricing" 
ON public.website_service_pricing 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy: Super Admin can INSERT pricing
CREATE POLICY "Super Admin can insert pricing" 
ON public.website_service_pricing 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Super Admin can UPDATE pricing
CREATE POLICY "Super Admin can update pricing" 
ON public.website_service_pricing 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy: Super Admin can DELETE pricing
CREATE POLICY "Super Admin can delete pricing" 
ON public.website_service_pricing 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 4. Create Function to Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_website_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_website_pricing_updated_at ON public.website_service_pricing;
CREATE TRIGGER trigger_update_website_pricing_updated_at
  BEFORE UPDATE ON public.website_service_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_website_pricing_updated_at();

-- =====================================================
-- 5. Create Helper View for Easy Querying
-- =====================================================
CREATE OR REPLACE VIEW public.website_pricing_view AS
SELECT 
  wsp.id,
  z.name AS zone_name,
  c.name AS city_name,
  c.state AS city_state,
  st.name AS service_name,
  st.description AS service_description,
  wsp.vehicle_class,
  wsp.base_price,
  wsp.tax_rate,
  wsp.final_price,
  wsp.is_active,
  wsp.created_at,
  wsp.updated_at,
  wsp.created_by,
  wsp.updated_by
FROM public.website_service_pricing wsp
JOIN public.zones z ON wsp.zone_id = z.id
JOIN public.cities c ON wsp.city_id = c.id
JOIN public.service_types st ON wsp.service_type_id = st.id
WHERE wsp.is_active = true;

-- =====================================================
-- 6. Create Function to Get Price for Zone-City-Service
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_website_service_price(
  p_zone_id UUID,
  p_city_id UUID,
  p_service_type_id UUID,
  p_vehicle_class VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  base_price NUMERIC,
  tax_rate NUMERIC,
  final_price NUMERIC,
  pricing_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wsp.base_price,
    wsp.tax_rate,
    wsp.final_price,
    wsp.id
  FROM public.website_service_pricing wsp
  WHERE wsp.zone_id = p_zone_id
    AND wsp.city_id = p_city_id
    AND wsp.service_type_id = p_service_type_id
    AND (wsp.vehicle_class = p_vehicle_class OR (wsp.vehicle_class IS NULL AND p_vehicle_class IS NULL))
    AND wsp.is_active = true
  ORDER BY 
    CASE WHEN wsp.vehicle_class IS NOT NULL THEN 0 ELSE 1 END -- Prefer class-specific pricing
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Add Comments for Documentation
-- =====================================================
COMMENT ON TABLE public.website_service_pricing IS 'Customer-facing service prices managed by Super Admin. Prices are set based on Zone + City + Service Type combination.';
COMMENT ON COLUMN public.website_service_pricing.zone_id IS 'Zone reference - prices can vary by zone';
COMMENT ON COLUMN public.website_service_pricing.city_id IS 'City reference - prices can vary by city within a zone';
COMMENT ON COLUMN public.website_service_pricing.service_type_id IS 'Service type reference';
COMMENT ON COLUMN public.website_service_pricing.base_price IS 'Base price before tax';
COMMENT ON COLUMN public.website_service_pricing.final_price IS 'Final price including tax (auto-calculated)';
COMMENT ON COLUMN public.website_service_pricing.vehicle_class IS 'Optional: Vehicle class for class-based pricing (HATCHBACK, SEDAN, SUV, etc.)';

-- =====================================================
-- 8. Success Notification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Website Service Pricing Table Created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table: website_service_pricing';
  RAISE NOTICE 'View: website_pricing_view';
  RAISE NOTICE 'Function: get_website_service_price()';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Super Admin can now manage prices by:';
  RAISE NOTICE '- Zone';
  RAISE NOTICE '- City';
  RAISE NOTICE '- Service Type';
  RAISE NOTICE '- Vehicle Class (optional)';
  RAISE NOTICE '========================================';
END $$;
