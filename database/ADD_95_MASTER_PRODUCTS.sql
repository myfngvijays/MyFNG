-- =====================================================
-- ADD/UPDATE 95 MASTER PRODUCTS
-- This script will:
-- 1. Update existing products that match by name (case-insensitive)
-- 2. Insert new products that don't exist
-- =====================================================

-- Create temporary table with all product data
CREATE TEMP TABLE temp_products (
  name VARCHAR(255),
  type VARCHAR(50),
  category VARCHAR(100),
  hsn_sac_code VARCHAR(20),
  unit VARCHAR(50),
  tax_rate NUMERIC(5,2),
  default_price NUMERIC(12,2)
);

-- Insert all 95 products into temp table
INSERT INTO temp_products (name, type, category, hsn_sac_code, unit, tax_rate, default_price) VALUES
('Engine Oil - Mineral 5W30', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 350.00),
('Engine Oil - Semi Synthetic 5W40', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 550.00),
('Engine Oil - Fully Synthetic 5W40', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 900.00),
('Engine Oil - 0W20', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 750.00),
('Engine Oil - 0W16', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 800.00),
('Engine Oil - 15W40', 'CONSUMABLE', 'Engine Oil', '271019', 'Ltr', 18.00, 400.00),
('Gear Oil 75W90', 'CONSUMABLE', 'Gear Oil', '271019', 'Ltr', 18.00, 450.00),
('Gear Oil 80W90', 'CONSUMABLE', 'Gear Oil', '271019', 'Ltr', 18.00, 350.00),
('Power Steering Oil', 'CONSUMABLE', 'Steering', '271019', 'Ltr', 18.00, 300.00),
('Brake Fluid DOT 3', 'CONSUMABLE', 'Brake', '381900', 'Bottle', 18.00, 120.00),
('Brake Fluid DOT 4', 'CONSUMABLE', 'Brake', '381900', 'Bottle', 18.00, 160.00),
('Coolant Ready Mix', 'CONSUMABLE', 'Coolant', '382000', 'Ltr', 18.00, 250.00),
('Coolant Concentrate', 'CONSUMABLE', 'Coolant', '382000', 'Ltr', 18.00, 350.00),
('Grease', 'CONSUMABLE', 'General', '271019', 'Kg', 18.00, 180.00),
('Engine Oil Filter', 'PART', 'Filters', '842123', 'pc', 18.00, 180.00),
('Fuel Filter Petrol', 'PART', 'Filters', '842123', 'pc', 18.00, 350.00),
('Fuel Filter Diesel', 'PART', 'Filters', '842123', 'pc', 18.00, 450.00),
('Diesel Filter CRDI', 'PART', 'Filters', '842123', 'pc', 18.00, 650.00),
('AC Cabin Filter', 'PART', 'Filters', '842131', 'pc', 18.00, 250.00),
('Air Filter', 'PART', 'Filters', '842131', 'pc', 18.00, 220.00),
('AC Gas R134a', 'CONSUMABLE', 'AC', '271113', 'Kg', 18.00, 550.00),
('AC Gas R1234yf', 'CONSUMABLE', 'AC', '290343', 'Kg', 18.00, 2200.00),
('AC Compressor Oil', 'CONSUMABLE', 'AC', '271019', 'Bottle', 18.00, 300.00),
('AC O-Ring Kit', 'PART', 'AC', '401693', 'pc', 18.00, 120.00),
('AC Filter Dryer', 'PART', 'AC', '842139', 'pc', 18.00, 450.00),
('AC High Pressure Pipe', 'PART', 'AC', '870899', 'pc', 18.00, 1500.00),
('AC Low Pressure Pipe', 'PART', 'AC', '870899', 'pc', 18.00, 1200.00),
('AC Compressor Relay', 'PART', 'AC', '853641', 'pc', 18.00, 180.00),
('Front Brake Pads', 'PART', 'Brake', '870830', 'pc', 18.00, 950.00),
('Rear Brake Pads', 'PART', 'Brake', '870830', 'pc', 18.00, 850.00),
('Brake Shoes', 'PART', 'Brake', '870830', 'pc', 18.00, 650.00),
('Brake Disc Rotor', 'PART', 'Brake', '870830', 'pc', 18.00, 1800.00),
('Brake Drum', 'PART', 'Brake', '870830', 'pc', 18.00, 1700.00),
('Brake Caliper Pin', 'PART', 'Brake', '870830', 'pc', 18.00, 150.00),
('ABS Sensor', 'PART', 'Brake', '854370', 'pc', 18.00, 850.00),
('Front Shock Absorber', 'PART', 'Suspension', '870880', 'pc', 18.00, 2500.00),
('Rear Shock Absorber', 'PART', 'Suspension', '870880', 'pc', 18.00, 1800.00),
('Lower Arm', 'PART', 'Suspension', '870880', 'pc', 18.00, 1500.00),
('Upper Arm', 'PART', 'Suspension', '870880', 'pc', 18.00, 1800.00),
('Stabilizer Link Rod', 'PART', 'Suspension', '870880', 'pc', 18.00, 450.00),
('Ball Joint', 'PART', 'Suspension', '870880', 'pc', 18.00, 350.00),
('Suspension Bush Kit', 'PART', 'Suspension', '870880', 'pc', 18.00, 700.00),
('Strut Mount', 'PART', 'Suspension', '870880', 'pc', 18.00, 900.00),
('Spark Plug', 'PART', 'Electrical', '851110', 'pc', 18.00, 120.00),
('Ignition Coil', 'PART', 'Electrical', '851130', 'pc', 18.00, 1800.00),
('Headlight Bulb H4', 'PART', 'Electrical', '853921', 'pc', 18.00, 150.00),
('Headlight Bulb H7', 'PART', 'Electrical', '853921', 'pc', 18.00, 250.00),
('Fog Lamp Bulb', 'PART', 'Electrical', '853921', 'pc', 18.00, 200.00),
('Battery 35AH', 'PART', 'Electrical', '850710', 'pc', 18.00, 4200.00),
('Battery 45AH', 'PART', 'Electrical', '850710', 'pc', 18.00, 5200.00),
('Battery 60AH', 'PART', 'Electrical', '850710', 'pc', 18.00, 6200.00),
('Wiper Blade Set', 'PART', 'Electrical', '851290', 'pc', 18.00, 350.00),
('Starter Motor', 'PART', 'Electrical', '851140', 'pc', 18.00, 4500.00),
('Alternator', 'PART', 'Electrical', '851150', 'pc', 18.00, 6500.00),
('Screen Wash', 'CONSUMABLE', 'Cleaning', '340220', 'Ltr', 18.00, 50.00),
('Interior Cleaner', 'CONSUMABLE', 'Cleaning', '340290', 'Bottle', 18.00, 180.00),
('Degreaser', 'CONSUMABLE', 'Cleaning', '340212', 'Bottle', 18.00, 150.00),
('Dashboard Polish', 'CONSUMABLE', 'Cleaning', '330730', 'Bottle', 18.00, 200.00),
('Tyre Polish', 'CONSUMABLE', 'Cleaning', '330730', 'Bottle', 18.00, 160.00),
('Shampoo Foam', 'CONSUMABLE', 'Cleaning', '340219', 'Bottle', 18.00, 120.00),
('Ceramic Coating', 'CONSUMABLE', 'Detailing', '320890', 'Bottle', 18.00, 1800.00),
('Rubbing Compound', 'CONSUMABLE', 'Polishing', '340530', 'Bottle', 18.00, 150.00),
('Teflon Polish', 'CONSUMABLE', 'Polishing', '340530', 'Bottle', 18.00, 350.00),
('APC – All Purpose Cleaner', 'CONSUMABLE', 'Cleaning', '340219', 'Bottle', 18.00, 140.00),
('Body Filler Putty', 'CONSUMABLE', 'Denting', '321410', 'Kg', 18.00, 180.00),
('Primer', 'CONSUMABLE', 'Painting', '320890', 'Ltr', 18.00, 350.00),
('Base Coat Paint', 'CONSUMABLE', 'Painting', '320810', 'Ltr', 18.00, 900.00),
('Clear Coat', 'CONSUMABLE', 'Painting', '320890', 'Ltr', 18.00, 950.00),
('Sandpaper 100 Grit', 'CONSUMABLE', 'Denting', '680530', 'pc', 18.00, 15.00),
('Sandpaper 180 Grit', 'CONSUMABLE', 'Denting', '680530', 'pc', 18.00, 15.00),
('Sandpaper 400 Grit', 'CONSUMABLE', 'Denting', '680530', 'pc', 18.00, 15.00),
('Thinner', 'CONSUMABLE', 'Painting', '381400', 'Ltr', 18.00, 180.00),
('Touch-up Paint', 'CONSUMABLE', 'Painting', '320810', 'pc', 18.00, 220.00),
('Wheel Balancing Weights', 'CONSUMABLE', 'Tyre', '831000', 'pc', 18.00, 3.00),
('Tyre Valve', 'PART', 'Tyre', '848180', 'pc', 18.00, 40.00),
('Puncture Strip', 'CONSUMABLE', 'Tyre', '401700', 'pc', 18.00, 15.00),
('Wheel Alignment Shims', 'PART', 'Tyre', '848310', 'pc', 18.00, 30.00),
('WD40', 'CONSUMABLE', 'General', '271019', 'Bottle', 18.00, 220.00),
('Thread Locker (Loctite)', 'CONSUMABLE', 'General', '350699', 'Bottle', 18.00, 180.00),
('Zip Ties Pack', 'CONSUMABLE', 'General', '392690', 'pc', 18.00, 70.00),
('Electrical Tape', 'CONSUMABLE', 'General', '391910', 'pc', 18.00, 12.00),
('Microfiber Cloth', 'CONSUMABLE', 'General', '630710', 'pc', 18.00, 40.00),
('Disposable Gloves', 'CONSUMABLE', 'General', '401511', 'pc', 18.00, 8.00),
('M-Seal', 'CONSUMABLE', 'General', '321410', 'pc', 18.00, 25.00),
('Clutch Plate', 'PART', 'Clutch', '870893', 'pc', 18.00, 1800.00),
('Pressure Plate', 'PART', 'Clutch', '870893', 'pc', 18.00, 2200.00),
('Release Bearing', 'PART', 'Clutch', '870893', 'pc', 18.00, 650.00),
('Clutch Oil', 'CONSUMABLE', 'Clutch', '381900', 'Ltr', 18.00, 250.00),
('ATF Oil', 'CONSUMABLE', 'Gearbox', '271019', 'Ltr', 18.00, 550.00),
('Drive Belt', 'PART', 'Engine', '401039', 'pc', 18.00, 350.00),
('Timing Belt', 'PART', 'Engine', '401039', 'pc', 18.00, 900.00),
('Engine Mounting', 'PART', 'Engine', '870899', 'pc', 18.00, 1500.00),
('Radiator Hose', 'PART', 'Cooling', '400922', 'pc', 18.00, 250.00),
('Thermostat Valve', 'PART', 'Cooling', '848140', 'pc', 18.00, 450.00),
('Radiator Fan Motor', 'PART', 'Cooling', '841459', 'pc', 18.00, 1800.00);

-- Update existing products (case-insensitive name match)
UPDATE public.master_products mp
SET 
  type = tp.type,
  category = tp.category,
  hsn_sac_code = tp.hsn_sac_code,
  unit = tp.unit,
  tax_rate = tp.tax_rate,
  default_price = tp.default_price,
  updated_at = NOW()
FROM temp_products tp
WHERE LOWER(TRIM(mp.name)) = LOWER(TRIM(tp.name));

-- Insert new products that don't exist
INSERT INTO public.master_products (name, type, category, hsn_sac_code, unit, tax_rate, default_price, is_active)
SELECT 
  tp.name,
  tp.type,
  tp.category,
  tp.hsn_sac_code,
  tp.unit,
  tp.tax_rate,
  tp.default_price,
  true
FROM temp_products tp
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.master_products mp 
  WHERE LOWER(TRIM(mp.name)) = LOWER(TRIM(tp.name))
);

-- Clean up temp table
DROP TABLE temp_products;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify the data:
-- SELECT COUNT(*) as total_products FROM public.master_products;
-- 
-- SELECT name, type, category, hsn_sac_code, unit, tax_rate, default_price 
-- FROM public.master_products 
-- WHERE name IN ('Screen Wash', 'Engine Oil Filter', 'Oil Filter 1006')
-- ORDER BY name;
--
-- SELECT type, COUNT(*) as count 
-- FROM public.master_products 
-- GROUP BY type 
-- ORDER BY type;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All 95 products processed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Products updated: Existing products with matching names';
  RAISE NOTICE 'Products inserted: New products that did not exist';
  RAISE NOTICE '========================================';
END $$;
