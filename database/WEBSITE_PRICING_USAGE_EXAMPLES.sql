-- =====================================================
-- WEBSITE SERVICE PRICING - USAGE EXAMPLES
-- For Super Admin to manage customer-facing prices
-- =====================================================

-- =====================================================
-- 1. INSERT: Add new pricing for Zone-City-Service
-- =====================================================

-- Example: Add pricing for Oil Change service in Delhi (North Zone)
INSERT INTO public.website_service_pricing (
  zone_id,
  city_id,
  service_type_id,
  base_price,
  tax_rate,
  vehicle_class,
  is_active
)
SELECT 
  z.id AS zone_id,
  c.id AS city_id,
  st.id AS service_type_id,
  500.00 AS base_price,  -- Base price
  18.00 AS tax_rate,      -- 18% GST
  NULL AS vehicle_class,  -- NULL = applies to all classes
  true AS is_active
FROM public.zones z
CROSS JOIN public.cities c
CROSS JOIN public.service_types st
WHERE z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change'
ON CONFLICT (zone_id, city_id, service_type_id, COALESCE(vehicle_class, '')) 
DO UPDATE SET
  base_price = EXCLUDED.base_price,
  tax_rate = EXCLUDED.tax_rate,
  updated_at = NOW(),
  updated_by = auth.uid();

-- =====================================================
-- 2. UPDATE: Update existing pricing
-- =====================================================

-- Example: Update price for a specific service in a city
UPDATE public.website_service_pricing wsp
SET 
  base_price = 600.00,
  tax_rate = 18.00,
  updated_at = NOW(),
  updated_by = auth.uid()
FROM public.zones z, public.cities c, public.service_types st
WHERE wsp.zone_id = z.id
  AND wsp.city_id = c.id
  AND wsp.service_type_id = st.id
  AND z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change';

-- =====================================================
-- 3. QUERY: Get all pricing for a specific zone
-- =====================================================

SELECT 
  z.name AS zone,
  c.name AS city,
  st.name AS service,
  wsp.base_price,
  wsp.tax_rate,
  wsp.final_price,
  wsp.vehicle_class,
  wsp.is_active
FROM public.website_service_pricing wsp
JOIN public.zones z ON wsp.zone_id = z.id
JOIN public.cities c ON wsp.city_id = c.id
JOIN public.service_types st ON wsp.service_type_id = st.id
WHERE z.name = 'North Zone'
ORDER BY c.name, st.name;

-- =====================================================
-- 4. QUERY: Get pricing for a specific city
-- =====================================================

SELECT 
  st.name AS service_name,
  wsp.base_price,
  wsp.tax_rate,
  wsp.final_price,
  wsp.vehicle_class
FROM public.website_service_pricing wsp
JOIN public.cities c ON wsp.city_id = c.id
JOIN public.service_types st ON wsp.service_type_id = st.id
WHERE c.name = 'Delhi'
  AND wsp.is_active = true
ORDER BY st.name;

-- =====================================================
-- 5. QUERY: Get price for specific Zone-City-Service
-- =====================================================

-- Using the helper function
SELECT * FROM public.get_website_service_price(
  (SELECT id FROM public.zones WHERE name = 'North Zone'),
  (SELECT id FROM public.cities WHERE name = 'Delhi'),
  (SELECT id FROM public.service_types WHERE name = 'Oil Change'),
  NULL  -- vehicle_class (NULL = all classes)
);

-- =====================================================
-- 6. BULK INSERT: Add pricing for multiple cities in a zone
-- =====================================================

-- Example: Add same pricing for multiple cities in North Zone
INSERT INTO public.website_service_pricing (
  zone_id,
  city_id,
  service_type_id,
  base_price,
  tax_rate,
  is_active
)
SELECT 
  z.id AS zone_id,
  c.id AS city_id,
  st.id AS service_type_id,
  500.00 AS base_price,
  18.00 AS tax_rate,
  true AS is_active
FROM public.zones z
CROSS JOIN public.cities c
CROSS JOIN public.service_types st
WHERE z.name = 'North Zone'
  AND c.name IN ('Delhi', 'Noida', 'Gurgaon')
  AND st.name = 'Oil Change'
ON CONFLICT (zone_id, city_id, service_type_id, COALESCE(vehicle_class, '')) 
DO UPDATE SET
  base_price = EXCLUDED.base_price,
  tax_rate = EXCLUDED.tax_rate,
  updated_at = NOW();

-- =====================================================
-- 7. QUERY: View all pricing (using the view)
-- =====================================================

SELECT * FROM public.website_pricing_view
ORDER BY zone_name, city_name, service_name;

-- =====================================================
-- 8. UPDATE: Deactivate pricing (soft delete)
-- =====================================================

UPDATE public.website_service_pricing wsp
SET 
  is_active = false,
  updated_at = NOW()
FROM public.zones z, public.cities c, public.service_types st
WHERE wsp.zone_id = z.id
  AND wsp.city_id = c.id
  AND wsp.service_type_id = st.id
  AND z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change';

-- =====================================================
-- 9. QUERY: Find missing pricing combinations
-- =====================================================

-- Find cities that don't have pricing for a service
SELECT 
  z.name AS zone,
  c.name AS city,
  st.name AS service
FROM public.zones z
CROSS JOIN public.cities c
CROSS JOIN public.service_types st
LEFT JOIN public.website_service_pricing wsp ON 
  wsp.zone_id = z.id 
  AND wsp.city_id = c.id 
  AND wsp.service_type_id = st.id
  AND wsp.is_active = true
WHERE wsp.id IS NULL
  AND c.zone_id = z.id  -- Only cities in the zone
ORDER BY z.name, c.name, st.name;

-- =====================================================
-- 10. QUERY: Compare prices across zones
-- =====================================================

SELECT 
  st.name AS service,
  z.name AS zone,
  c.name AS city,
  wsp.base_price,
  wsp.final_price
FROM public.website_service_pricing wsp
JOIN public.zones z ON wsp.zone_id = z.id
JOIN public.cities c ON wsp.city_id = c.id
JOIN public.service_types st ON wsp.service_type_id = st.id
WHERE st.name = 'Oil Change'
  AND wsp.is_active = true
ORDER BY st.name, z.name, c.name;

-- =====================================================
-- NOTES FOR SUPER ADMIN:
-- =====================================================
-- 1. Always use zone_id + city_id + service_type_id combination
-- 2. vehicle_class is optional - leave NULL for all classes
-- 3. final_price is auto-calculated (base_price + tax)
-- 4. Use is_active = false to deactivate without deleting
-- 5. Use the view 'website_pricing_view' for easy querying
-- 6. Use function 'get_website_service_price()' in your API
-- =====================================================

