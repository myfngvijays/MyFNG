-- =====================================================
-- INSERT SAMPLE WEBSITE PRICING DATA
-- Purpose: Add sample pricing data for testing
-- =====================================================

-- =====================================================
-- Step 1: Check what data we have
-- =====================================================

-- Check available zones
SELECT id, name FROM public.zones ORDER BY name;

-- Check available cities
SELECT id, name, state, zone_id FROM public.cities ORDER BY name LIMIT 10;

-- Check available services
SELECT id, name FROM public.service_types ORDER BY name LIMIT 10;

-- =====================================================
-- Step 2: Insert Sample Pricing
-- =====================================================
-- Note: Update the IDs below based on your actual data

-- Example 1: Add pricing for Oil Change service in Delhi (North Zone)
-- Replace the IDs with your actual zone_id, city_id, and service_type_id

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
  500.00 AS base_price,  -- ₹500 base price
  18.00 AS tax_rate,      -- 18% GST
  NULL AS vehicle_class,  -- NULL = applies to all vehicle classes
  true AS is_active
FROM public.zones z
CROSS JOIN public.cities c
CROSS JOIN public.service_types st
WHERE z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change'  -- Update with your actual service name
ON CONFLICT DO NOTHING;

-- Example 2: Add pricing for multiple cities in a zone
-- Uncomment and update as needed

/*
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
  AND c.name IN ('Delhi', 'Noida', 'Gurgaon')  -- Multiple cities
  AND st.name = 'Oil Change'
ON CONFLICT DO NOTHING;
*/

-- Example 3: Add class-specific pricing (e.g., SUV has different price)
-- Uncomment and update as needed

/*
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
  700.00 AS base_price,  -- Higher price for SUV
  18.00 AS tax_rate,
  'SUV' AS vehicle_class,
  true AS is_active
FROM public.zones z
CROSS JOIN public.cities c
CROSS JOIN public.service_types st
WHERE z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change'
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- Step 3: Verify the data
-- =====================================================

-- View all pricing
SELECT * FROM public.website_pricing_view
ORDER BY zone_name, city_name, service_name;

-- Count pricing entries
SELECT 
  COUNT(*) as total_pricing_entries,
  COUNT(DISTINCT zone_id) as zones_covered,
  COUNT(DISTINCT city_id) as cities_covered,
  COUNT(DISTINCT service_type_id) as services_covered
FROM public.website_service_pricing
WHERE is_active = true;

-- =====================================================
-- Step 4: Test the helper function
-- =====================================================

-- Test getting price for a specific combination
-- Replace IDs with your actual IDs
/*
SELECT * FROM public.get_website_service_price(
  (SELECT id FROM public.zones WHERE name = 'North Zone'),
  (SELECT id FROM public.cities WHERE name = 'Delhi'),
  (SELECT id FROM public.service_types WHERE name = 'Oil Change'),
  NULL  -- vehicle_class (NULL = all classes)
);
*/

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Sample pricing data insertion ready!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Check your zones, cities, and services';
  RAISE NOTICE '2. Update the service names in the queries';
  RAISE NOTICE '3. Run the INSERT statements';
  RAISE NOTICE '4. Verify using website_pricing_view';
  RAISE NOTICE '========================================';
END $$;

