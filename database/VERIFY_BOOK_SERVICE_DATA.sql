-- ============================================
-- Verify Data for Book Service Page
-- ============================================

-- 1. Check if cities exist
SELECT 
  'Cities' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM cities;

-- 2. Check if car models exist
SELECT 
  'Car Models' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM car_models;

-- 3. Check if service types exist
SELECT 
  'Service Types' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM service_types;

-- 4. Check specific service types needed
SELECT 
  id,
  name,
  description,
  is_active
FROM service_types
WHERE name ILIKE '%basic%service%'
   OR name ILIKE '%general%service%'
   OR name ILIKE '%premium%service%'
   OR name ILIKE '%platinum%service%'
ORDER BY name;

-- 5. Check if pricing exists
SELECT 
  'Pricing Entries' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM workshop_service_pricing;

-- 6. Sample active cities
SELECT id, name, state, zone_id, is_active
FROM cities
WHERE is_active = true
ORDER BY name
LIMIT 10;

-- 7. Sample active car models
SELECT id, make, model_name, class, is_active
FROM car_models
WHERE is_active = true
ORDER BY make, model_name
LIMIT 10;

-- 8. Check RLS policies on tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('cities', 'car_models', 'service_types', 'workshop_service_pricing')
ORDER BY tablename, policyname;

-- 9. Check if anon role has access
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('cities', 'car_models', 'service_types', 'workshop_service_pricing')
  AND 'anon' = ANY(roles)
GROUP BY tablename;

