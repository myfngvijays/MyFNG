-- ================================================
-- UPDATE CAR MODELS - Safe Update (No Delete)
-- ================================================
-- This script will:
-- 1. Update existing models with new class
-- 2. Add new models
-- 3. Keep existing IDs (no foreign key issues)
-- ================================================

-- Step 1: Update existing Maruti models
UPDATE car_models SET make = 'MARUTI', model_name = 'SWIFT', variant = 'HATCHBACK' 
WHERE id = 'a0000001-0001-0001-0001-000000000001';

UPDATE car_models SET make = 'MARUTI', model_name = 'BALENO', variant = 'PREMIUM HATCHBACK' 
WHERE id = 'a0000001-0001-0001-0001-000000000002';

UPDATE car_models SET make = 'MARUTI', model_name = 'WAGON R', variant = 'HATCHBACK' 
WHERE id = 'a0000001-0001-0001-0001-000000000003';

UPDATE car_models SET make = 'MARUTI', model_name = 'DZIRE', variant = 'SEDANS' 
WHERE id = 'a0000001-0001-0001-0001-000000000004';

UPDATE car_models SET make = 'MARUTI', model_name = 'ERTIGA', variant = 'COMPACT SUV' 
WHERE id = 'a0000001-0001-0001-0001-000000000005';

-- Step 2: Update existing Hyundai models
UPDATE car_models SET make = 'HYUNDAI', model_name = 'I 20', variant = 'PREMIUM HATCHBACK' 
WHERE id = 'b0000002-0002-0002-0002-000000000001';

UPDATE car_models SET make = 'HYUNDAI', model_name = 'CRETA', variant = 'SUV/MUVs' 
WHERE id = 'b0000002-0002-0002-0002-000000000002';

UPDATE car_models SET make = 'HYUNDAI', model_name = 'VENUE', variant = 'COMPACT SUV' 
WHERE id = 'b0000002-0002-0002-0002-000000000003';

UPDATE car_models SET make = 'HYUNDAI', model_name = 'VERNA', variant = 'SEDANS' 
WHERE id = 'b0000002-0002-0002-0002-000000000004';

-- Step 3: Update existing Tata models
UPDATE car_models SET make = 'TATA', model_name = 'NEXON', variant = 'COMPACT SUV' 
WHERE id = 'c0000003-0003-0003-0003-000000000001';

UPDATE car_models SET make = 'TATA', model_name = 'HARRIER', variant = 'PREMIUM SUV/MUVs' 
WHERE id = 'c0000003-0003-0003-0003-000000000002';

UPDATE car_models SET make = 'TATA', model_name = 'ALTROZ', variant = 'PREMIUM HATCHBACK' 
WHERE id = 'c0000003-0003-0003-0003-000000000003';

-- Step 4: Insert NEW models (only those not already present)
INSERT INTO car_models (make, model_name, variant, is_active) VALUES
-- Hyundai (New)
('HYUNDAI', 'ACCENT', 'SEDANS', true),
('HYUNDAI', 'ALCAZAR', 'SUV/MUVs', true),
('HYUNDAI', 'AURA', 'SEDANS', true),
('HYUNDAI', 'EXTER', 'PREMIUM HATCHBACK', true),
('HYUNDAI', 'ELANTRA', 'SEDANS', true),
('HYUNDAI', 'EON', 'HATCHBACK', true),
('HYUNDAI', 'GETZ', 'HATCHBACK', true),
('HYUNDAI', 'GRAND I10', 'HATCHBACK', true),
('HYUNDAI', 'SANTA', 'PREMIUM SUV/MUVs', true),
('HYUNDAI', 'SANTRO', 'HATCHBACK', true),
('HYUNDAI', 'SONATA', 'PREMIUM SUV/MUVs', true),
('HYUNDAI', 'TUCSON', 'PREMIUM SUV/MUVs', true),
('HYUNDAI', 'XCENT', 'SEDANS', true),

-- Honda (All New)
('HONDA', 'ACCORD', 'PREMIUM LUXURY', true),
('HONDA', 'AMAZE', 'SEDANS', true),
('HONDA', 'BRIO', 'HATCHBACK', true),
('HONDA', 'BRV', 'SEDANS', true),
('HONDA', 'CITY', 'SEDANS', true),
('HONDA', 'CIVIC', 'SEDANS', true),
('HONDA', 'JAZZ', 'PREMIUM HATCHBACK', true),
('HONDA', 'WRV', 'PREMIUM HATCHBACK', true),
('HONDA', 'CRV', 'SUV/MUVs', true),
('HONDA', 'MOBILIO', 'SEDANS', true),

-- Maruti (New - additional models)
('MARUTI', 'ALTO', 'HATCHBACK', true),
('MARUTI', 'CELERIO', 'HATCHBACK', true),
('MARUTI', 'CIAZ', 'SEDANS', true),
('MARUTI', 'EECO', 'SEDANS', true),
('MARUTI', 'ESTEEM', 'SEDANS', true),
('MARUTI', 'FRONX', 'COMPACT SUV', true),
('MARUTI', 'GRAND VITARA', 'SUV/MUVs', true),
('MARUTI', 'GYPSY', 'COMPACT SUV', true),
('MARUTI', 'IGNIS', 'PREMIUM HATCHBACK', true),
('MARUTI', 'OMNI', 'SEDANS', true),
('MARUTI', 'RITZ', 'HATCHBACK', true),
('MARUTI', 'S CROSS', 'COMPACT SUV', true),
('MARUTI', 'S PRESSO', 'HATCHBACK', true),
('MARUTI', 'SX4', 'SEDANS', true),
('MARUTI', 'TOUR', 'SEDANS', true),
('MARUTI', 'VERSA', 'SEDANS', true),
('MARUTI', 'VITARA BREZZA', 'SUV/MUVs', true),
('MARUTI', 'XL6', 'COMPACT SUV', true),
('MARUTI', 'ZEN', 'HATCHBACK', true),
('MARUTI', 'ZEN ESTILO', 'HATCHBACK', true),
('MARUTI', 'A STAR', 'HATCHBACK', true),

-- Tata (New - additional models)
('TATA', 'ARIA', 'SUV/MUVs', true),
('TATA', 'BOLT', 'HATCHBACK', true),
('TATA', 'HEXA', 'SUV/MUVs', true),
('TATA', 'INDICA', 'HATCHBACK', true),
('TATA', 'INDIGO', 'SEDANS', true),
('TATA', 'MANZA', 'SEDANS', true),
('TATA', 'NANO', 'HATCHBACK', true),
('TATA', 'PUNCH', 'PREMIUM HATCHBACK', true),
('TATA', 'SAFARI OLD', 'SUV/MUVs', true),
('TATA', 'SAFARI NEW', 'PREMIUM SUV/MUVs', true),
('TATA', 'SUMO', 'SUV/MUVs', true),
('TATA', 'TIAGO', 'SEDANS', true),
('TATA', 'TIGOR', 'SEDANS', true),
('TATA', 'VISTA', 'SEDANS', true),
('TATA', 'ZEST', 'SEDANS', true),
('TATA', 'SAFARI (OLD)', 'SUV/MUVs', true),

-- Toyota (All New)
('TOYOTA', 'CAMRY', 'PREMIUM LUXURY', true),
('TOYOTA', 'COROLLA', 'SEDANS', true),
('TOYOTA', 'CRYSTA', 'SUV/MUVs', true),
('TOYOTA', 'ETIOS', 'SEDANS', true),
('TOYOTA', 'FORTUNER', 'PREMIUM SUV/MUVs', true),
('TOYOTA', 'GLANZA', 'PREMIUM HATCHBACK', true),
('TOYOTA', 'INNOVA', 'SUV/MUVs', true),
('TOYOTA', 'QUALIS', 'SUV/MUVs', true),
('TOYOTA', 'URBAN CRUISER', 'COMPACT SUV', true),
('TOYOTA', 'YARIS', 'SEDANS', true),
('TOYOTA', 'LIVA', 'HATCHBACK', true),
('TOYOTA', 'TAISOR', 'COMPACT SUV', true),
('TOYOTA', 'RUMION', 'COMPACT SUV', true),
('TOYOTA', 'HYRYDER', 'SUV/MUVs', true),
('TOYOTA', 'HYCROSS', 'PREMIUM SUV/MUVs', true),
('TOYOTA', 'ETIOS CROSS', 'PREMIUM HATCHBACK', true),

-- Mahindra (All New)
('MAHINDRA', 'ALTURAS', 'SUV/MUVs', true),
('MAHINDRA', 'BOLERO', 'SUV/MUVs', true),
('MAHINDRA', 'LOGAN', 'SEDANS', true),
('MAHINDRA', 'MAARZZO', 'SUV/MUVs', true),
('MAHINDRA', 'QUANTO', 'SUV/MUVs', true),
('MAHINDRA', 'SCORPIO', 'SUV/MUVs', true),
('MAHINDRA', 'THAR', 'SUV/MUVs', true),
('MAHINDRA', 'TUV 300', 'SUV/MUVs', true),
('MAHINDRA', 'VERITO', 'SEDANS', true),
('MAHINDRA', 'XUV 300', 'COMPACT SUV', true),
('MAHINDRA', 'XUV 500', 'COMPACT SUV', true),
('MAHINDRA', 'XUV 700', 'PREMIUM SUV/MUVs', true),
('MAHINDRA', 'XYLO', 'SUV/MUVs', true),
('MAHINDRA', 'KUV 100', 'PREMIUM HATCHBACK', true),
('MAHINDRA', 'NUVOSPORT', 'SUV/MUVs', true),
('MAHINDRA', 'GENIO', 'SUV/MUVs', true),

-- KIA (All New)
('KIA', 'SELTOS', 'SUV/MUVs', true),
('KIA', 'SONET', 'COMPACT SUV', true),
('KIA', 'CARENS', 'SUV/MUVs', true),
('KIA', 'CARNIVAL', 'PREMIUM SUV/MUVs', true),

-- MG (All New)
('MG', 'GLOSTER', 'PREMIUM SUV/MUVs', true),
('MG', 'HECTOR', 'PREMIUM SUV/MUVs', true),

-- Nissan (All New)
('NISSAN', 'DATSUN', 'COMPACT SUV', true),
('NISSAN', 'KICKS', 'COMPACT SUV', true),
('NISSAN', 'MAGNITE', 'COMPACT SUV', true),
('NISSAN', 'MICRA', 'HATCHBACK', true),
('NISSAN', 'SUNNY', 'SEDANS', true),
('NISSAN', 'TERRANO', 'SUV/MUVs', true),

-- Renault (All New)
('RENAULT', 'DUSTER', 'COMPACT SUV', true),
('RENAULT', 'KIGER', 'COMPACT SUV', true),
('RENAULT', 'KWID', 'HATCHBACK', true),
('RENAULT', 'PULSE', 'HATCHBACK', true),
('RENAULT', 'SCALA', 'SEDANS', true),
('RENAULT', 'TRIBER', 'SEDANS', true),
('RENAULT', 'LODGY', 'PREMIUM HATCHBACK', true),

-- Ford (All New)
('FORD', 'ASPIRE', 'SEDANS', true),
('FORD', 'ECO SPORT', 'COMPACT SUV', true),
('FORD', 'ENDEAVOUR', 'PREMIUM HATCHBACK', true),
('FORD', 'FIESTA', 'PREMIUM HATCHBACK', true),
('FORD', 'FIGO', 'HATCHBACK', true),
('FORD', 'FUSION', 'PREMIUM HATCHBACK', true),
('FORD', 'IKON', 'SEDANS', true),
('FORD', 'FREESTYLE', 'PREMIUM HATCHBACK', true),

-- Skoda (All New)
('SKODA', 'FABIA', 'PREMIUM HATCHBACK', true),
('SKODA', 'KODIAQ', 'PREMIUM SUV/MUVs', true),
('SKODA', 'KUSHAQ', 'PREMIUM SUV/MUVs', true),
('SKODA', 'LAURA', 'PREMIUM LUXURY', true),
('SKODA', 'OCTAIVA', 'PREMIUM LUXURY', true),
('SKODA', 'RAPID', 'SEDANS', true),
('SKODA', 'SUPERB', 'PREMIUM LUXURY', true),
('SKODA', 'SALIVA', 'PREMIUM HATCHBACK', true),
('SKODA', 'SLAVIA', 'SEDANS', true),

-- Volkswagen (All New)
('VOLKSWAGEN', 'JETTA', 'PREMIUM LUXURY', true),
('VOLKSWAGEN', 'PASSAT', 'PREMIUM LUXURY', true),
('VOLKSWAGEN', 'POLO', 'PREMIUM HATCHBACK', true),
('VOLKSWAGEN', 'TIGUAN', 'SUV/MUVs', true),
('VOLKSWAGEN', 'VIRTUS', 'SEDANS', true),

-- Chevrolet (All New)
('CHEVROLET', 'AMEO', 'SEDANS', true),
('CHEVROLET', 'AVEO', 'SEDANS', true),
('CHEVROLET', 'BEAT', 'HATCHBACK', true),
('CHEVROLET', 'CRUZE', 'PREMIUM SUV/MUVs', true),
('CHEVROLET', 'SAIL', 'SEDANS', true),
('CHEVROLET', 'SPARK', 'HATCHBACK', true),
('CHEVROLET', 'TAVERA', 'SUV/MUVs', true),
('CHEVROLET', 'ENJOY', 'COMPACT SUV', true),

-- FCA (Fiat)
('FCA', 'LINEA', 'PREMIUM HATCHBACK', true),
('FCA', 'PALIO', 'HATCHBACK', true),
('FCA', 'PUNTO', 'HATCHBACK', true),

-- Premium Brands
('MERCEDES', 'MERCEDES', 'PREMIUM LUXURY', true),
('JAGUAR', 'JAGUAR', 'PREMIUM LUXURY', true),
('BMW', 'BMW', 'PREMIUM LUXURY', true),
('AUDI', 'AUDI', 'PREMIUM LUXURY', true),

-- Others
('ISUJU', 'ISUJU D MAX', 'PREMIUM SUV/MUVs', true),
('JEEP', 'COMPASS', 'SUV/MUVs', true),
('OTHERS', 'VENTO', 'SEDANS', true);

-- Verify the update
SELECT 
  COUNT(*) as total_models,
  COUNT(DISTINCT make) as total_makes
FROM car_models;

-- Show updated records
SELECT make, model_name, variant as class, is_active
FROM car_models
WHERE make IN ('MARUTI', 'HYUNDAI', 'TATA', 'HONDA', 'TOYOTA')
ORDER BY make, model_name;

