-- ================================================
-- UPDATE SERVICE TYPES & ADDONS - Safe Update
-- ================================================
-- This script will:
-- 1. Update existing service types
-- 2. Add new service types
-- 3. Update existing service addons
-- 4. Add new service addons
-- ================================================

-- ========================================
-- PART 1: UPDATE SERVICE TYPES
-- ========================================

-- Update existing 8 service types
UPDATE service_types SET name = 'Basic Service (15 Points)', description = 'Basic maintenance package with 15 checkpoints' 
WHERE id = 'd0000001-0001-0001-0001-000000000001';

UPDATE service_types SET name = 'AC Performance Package', description = 'Complete AC system service' 
WHERE id = 'd0000001-0001-0001-0001-000000000002';

UPDATE service_types SET name = 'Engine Tune Up Package', description = 'Comprehensive engine tuning' 
WHERE id = 'd0000001-0001-0001-0001-000000000003';

UPDATE service_types SET name = 'Brake Services', description = 'Complete brake system maintenance' 
WHERE id = 'd0000001-0001-0001-0001-000000000004';

UPDATE service_types SET name = 'Battery Jump Start', description = 'Battery testing and jump start service' 
WHERE id = 'd0000001-0001-0001-0001-000000000005';

UPDATE service_types SET name = 'Complete Wheel Care (Wheel Alignment & Balancing)', description = 'Wheel alignment, balancing & rotation' 
WHERE id = 'd0000001-0001-0001-0001-000000000006';

UPDATE service_types SET name = 'FULL BODY PAINTING', description = 'Complete vehicle body painting' 
WHERE id = 'd0000001-0001-0001-0001-000000000007';

UPDATE service_types SET name = '360 Deep Cleaning', description = 'Complete interior & exterior deep cleaning' 
WHERE id = 'd0000001-0001-0001-0001-000000000008';

-- Add NEW service types
INSERT INTO service_types (name, description, is_active) VALUES
('General Service (30 Points)', 'Standard maintenance with 30 checkpoints', true),
('Premium Service (50 Points)', 'Premium maintenance with 50 checkpoints', true),
('Platinum Service (60 Points)', 'Platinum maintenance with 60 checkpoints', true),
('Clutch Maintenance Package', 'Clutch system inspection and maintenance', true),
('High Performance AC Service', 'Premium AC service with deep cleaning', true),
('GAS Charging', 'AC refrigerant gas charging', true),
('Brake Booster Replacement', 'Brake booster replacement service', true),
('Brake Cylinders Replacement', 'Brake cylinder replacement service', true),
('Battery Charging', 'Battery charging and testing', true),
('Winter Care Package', 'Complete winter preparation package', true),
('Car Interior Spa', 'Premium interior detailing and spa', true),
('Deep All Round Spa', 'Complete interior and exterior spa', true),
('Premium Top Wash', 'Premium exterior wash and shine', true),
('Front Bumper Paint', 'Front bumper painting service', true),
('Right Fender Paint', 'Right fender painting', true),
('Left Fender Paint', 'Left fender painting', true),
('Bonnet Paint', 'Bonnet painting service', true),
('Right Front Door Paint', 'Right front door painting', true),
('Right Rear Door Paint', 'Right rear door painting', true),
('Left Front Door Paint', 'Left front door painting', true),
('Left Rear Door Paint', 'Left rear door painting', true),
('Right Quarter Panel Paint', 'Right quarter panel painting', true),
('Left Quarter Panel Paint', 'Left quarter panel painting', true),
('Rear Bumper Paint', 'Rear bumper painting', true),
('Car Dicky Paint', 'Dicky/Boot painting', true),
('Roof Top Paint', 'Roof top painting', true),
('3M Wax Polish / Teflon Coating', '3M premium wax polish with Teflon coating', true),
('3M Interior Cleaning', '3M professional interior cleaning', true),
('3M Exterior Cleaning', '3M professional exterior cleaning', true),
('Nano Ceramic Coating (Single Layer)', 'Single layer nano ceramic coating', true),
('Nano Ceramic Coating (Double Layer)', 'Double layer nano ceramic coating', true),
('Antirust Under Body Coating', 'Antirust underbody protection coating', true),
('Silencer Coating', 'Silencer heat resistant coating', true);

-- ========================================
-- PART 2: UPDATE SERVICE ADDONS
-- ========================================

-- Update existing 8 addons
UPDATE service_addons SET name = 'Semi Synthetic Oil', description = 'Semi synthetic engine oil', price = 500 
WHERE id = 'e0000001-0001-0001-0001-000000000001';

UPDATE service_addons SET name = 'Fully Synthetic Oil', description = 'Fully synthetic premium oil', price = 1200 
WHERE id = 'e0000001-0001-0001-0001-000000000002';

UPDATE service_addons SET name = 'Air Filter', description = 'Engine air filter replacement', price = 300 
WHERE id = 'e0000001-0001-0001-0001-000000000003';

UPDATE service_addons SET name = 'Cabin Filter', description = 'AC cabin filter replacement', price = 400 
WHERE id = 'e0000001-0001-0001-0001-000000000004';

UPDATE service_addons SET name = 'Fuel Filter', description = 'Fuel filter replacement', price = 350 
WHERE id = 'e0000001-0001-0001-0001-000000000005';

UPDATE service_addons SET name = 'Engine Oil Flush', description = 'Engine cleaning treatment', price = 250 
WHERE id = 'e0000001-0001-0001-0001-000000000006';

UPDATE service_addons SET name = 'AC Gas Top-up', description = 'AC refrigerant gas filling', price = 600 
WHERE id = 'e0000001-0001-0001-0001-000000000007';

UPDATE service_addons SET name = 'Underbody Coating', description = 'Rust protection coating', price = 2500 
WHERE id = 'e0000001-0001-0001-0001-000000000008';

-- Add NEW service addons (if needed - currently keeping existing as they are comprehensive)
-- You can add more addons here if needed

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check service types count
SELECT 
  COUNT(*) as total_service_types,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_types
FROM service_types;

-- Check service addons count
SELECT 
  COUNT(*) as total_addons,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_addons
FROM service_addons;

-- Show all service types
SELECT name, description, is_active
FROM service_types
ORDER BY name;

-- Show all service addons
SELECT name, description, price, is_active
FROM service_addons
ORDER BY price DESC;

