-- ============================================
-- TELECALLER LEAD CREATION - DATABASE SETUP
-- ============================================
-- Run this file to enable full lead creation functionality
-- with UUID-based city_id and model_id fields
-- 
-- ⚠️  WARNING: This will DROP and RECREATE tables:
-- - cities
-- - car_models
-- - service_types
-- - service_addons
--
-- All existing data in these tables will be LOST!
-- If you have important data, backup first.
-- ============================================

-- Step 1: Recreate cities table with UUID
-- ============================================
-- Drop existing table if it uses INTEGER id
DROP TABLE IF EXISTS public.cities CASCADE;

-- Create cities table with UUID
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample cities with UUIDs
INSERT INTO public.cities (id, name, state, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mumbai', 'Maharashtra', true),
  ('22222222-2222-2222-2222-222222222222', 'Navi Mumbai', 'Maharashtra', true),
  ('33333333-3333-3333-3333-333333333333', 'Thane', 'Maharashtra', true),
  ('44444444-4444-4444-4444-444444444444', 'Pune', 'Maharashtra', true),
  ('55555555-5555-5555-5555-555555555555', 'Delhi', 'Delhi', true),
  ('66666666-6666-6666-6666-666666666666', 'Bangalore', 'Karnataka', true),
  ('77777777-7777-7777-7777-777777777777', 'Hyderabad', 'Telangana', true),
  ('88888888-8888-8888-8888-888888888888', 'Chennai', 'Tamil Nadu', true);


-- Step 2: Recreate car_models table with UUID
-- ============================================
-- Drop existing table if it uses INTEGER id
DROP TABLE IF EXISTS public.car_models CASCADE;

-- Create car_models table with UUID
CREATE TABLE public.car_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make VARCHAR(100) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  variant VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample car models with UUIDs
INSERT INTO public.car_models (id, make, model_name, variant, is_active) VALUES
  -- Maruti Suzuki
  ('a0000001-0001-0001-0001-000000000001', 'Maruti Suzuki', 'Swift', 'VXI', true),
  ('a0000001-0001-0001-0001-000000000002', 'Maruti Suzuki', 'Baleno', 'Sigma', true),
  ('a0000001-0001-0001-0001-000000000003', 'Maruti Suzuki', 'WagonR', 'LXI', true),
  ('a0000001-0001-0001-0001-000000000004', 'Maruti Suzuki', 'Dzire', 'VXI', true),
  ('a0000001-0001-0001-0001-000000000005', 'Maruti Suzuki', 'Ertiga', 'VXI', true),
  
  -- Hyundai
  ('b0000002-0002-0002-0002-000000000001', 'Hyundai', 'i20', 'Magna', true),
  ('b0000002-0002-0002-0002-000000000002', 'Hyundai', 'Creta', 'E', true),
  ('b0000002-0002-0002-0002-000000000003', 'Hyundai', 'Venue', 'E', true),
  ('b0000002-0002-0002-0002-000000000004', 'Hyundai', 'Verna', 'E', true),
  
  -- Tata
  ('c0000003-0003-0003-0003-000000000001', 'Tata', 'Nexon', 'XE', true),
  ('c0000003-0003-0003-0003-000000000002', 'Tata', 'Harrier', 'XE', true),
  ('c0000003-0003-0003-0003-000000000003', 'Tata', 'Altroz', 'XE', true);


-- Step 3: Recreate service_types table with UUID
-- ============================================
-- Drop existing table if it uses INTEGER id
DROP TABLE IF EXISTS public.service_types CASCADE;

-- Create service_types table with UUID
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample service types with UUIDs
INSERT INTO public.service_types (id, name, description, is_active) VALUES
  ('d0000001-0001-0001-0001-000000000001', 'General Service', 'Regular maintenance', true),
  ('d0000001-0001-0001-0001-000000000002', 'AC Service', 'AC repair & gas filling', true),
  ('d0000001-0001-0001-0001-000000000003', 'Oil Change', 'Engine oil replacement', true),
  ('d0000001-0001-0001-0001-000000000004', 'Brake Service', 'Brake pad & disk service', true),
  ('d0000001-0001-0001-0001-000000000005', 'Battery Replacement', 'New battery installation', true),
  ('d0000001-0001-0001-0001-000000000006', 'Tire Service', 'Tire rotation & alignment', true),
  ('d0000001-0001-0001-0001-000000000007', 'Denting & Painting', 'Body work', true),
  ('d0000001-0001-0001-0001-000000000008', 'Car Wash & Detailing', 'Exterior & interior cleaning', true);


-- Step 4: Recreate service_addons table with UUID
-- ============================================
-- Drop existing table if it uses INTEGER id
DROP TABLE IF EXISTS public.service_addons CASCADE;

-- Create service_addons table with UUID
CREATE TABLE public.service_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample service add-ons with UUIDs
INSERT INTO public.service_addons (id, name, description, price, is_active) VALUES
  ('e0000001-0001-0001-0001-000000000001', 'Semi Synthetic Oil', 'Semi synthetic engine oil', 500, true),
  ('e0000001-0001-0001-0001-000000000002', 'Fully Synthetic Oil', 'Fully synthetic premium oil', 1200, true),
  ('e0000001-0001-0001-0001-000000000003', 'Air Filter', 'Engine air filter replacement', 300, true),
  ('e0000001-0001-0001-0001-000000000004', 'Cabin Filter', 'AC cabin filter replacement', 400, true),
  ('e0000001-0001-0001-0001-000000000005', 'Fuel Filter', 'Fuel filter replacement', 350, true),
  ('e0000001-0001-0001-0001-000000000006', 'Engine Oil Flush', 'Engine cleaning treatment', 250, true),
  ('e0000001-0001-0001-0001-000000000007', 'AC Gas Top-up', 'AC refrigerant gas filling', 600, true),
  ('e0000001-0001-0001-0001-000000000008', 'Underbody Coating', 'Rust protection coating', 2500, true);


-- Step 5: Verify payment_mode column exists
-- ============================================
-- This should already be added, but let's verify
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_leads' AND column_name='payment_mode'
  ) THEN
    ALTER TABLE public.service_leads 
    ADD COLUMN payment_mode VARCHAR(20) 
    CHECK (payment_mode IN ('PREPAID', 'COD', 'WALLET', 'UPI', 'CARD'));
  END IF;
END $$;


-- Step 6: Update service_leads columns to UUID (if needed)
-- ============================================
DO $$ 
BEGIN
  -- Check if city_id is integer and convert to UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'city_id' 
    AND data_type = 'integer'
  ) THEN
    -- Drop existing foreign key if exists
    ALTER TABLE public.service_leads 
    DROP CONSTRAINT IF EXISTS service_leads_city_id_fkey;
    
    -- Change column type to UUID
    ALTER TABLE public.service_leads 
    ALTER COLUMN city_id TYPE UUID USING NULL;
  END IF;
  
  -- Check if model_id is integer and convert to UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'model_id' 
    AND data_type = 'integer'
  ) THEN
    -- Drop existing foreign key if exists
    ALTER TABLE public.service_leads 
    DROP CONSTRAINT IF EXISTS service_leads_model_id_fkey;
    
    -- Change column type to UUID
    ALTER TABLE public.service_leads 
    ALTER COLUMN model_id TYPE UUID USING NULL;
  END IF;
END $$;

-- Add foreign key constraints (if not exists)
-- ============================================
-- City foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'service_leads_city_id_fkey'
  ) THEN
    ALTER TABLE public.service_leads
    ADD CONSTRAINT service_leads_city_id_fkey 
    FOREIGN KEY (city_id) REFERENCES public.cities(id);
  END IF;
END $$;

-- Model foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'service_leads_model_id_fkey'
  ) THEN
    ALTER TABLE public.service_leads
    ADD CONSTRAINT service_leads_model_id_fkey 
    FOREIGN KEY (model_id) REFERENCES public.car_models(id);
  END IF;
END $$;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all tables exist and have data
SELECT 'Cities Table' as table_name, COUNT(*) as record_count FROM cities
UNION ALL
SELECT 'Car Models Table', COUNT(*) FROM car_models
UNION ALL
SELECT 'Service Types Table', COUNT(*) FROM service_types
UNION ALL
SELECT 'Service Addons Table', COUNT(*) FROM service_addons;

-- Verify service_leads columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'service_leads'
  AND column_name IN (
    'city_id', 'model_id', 'customer_lat', 'customer_lng',
    'service_type_ids', 'subservice_ids', 'payment_mode',
    'preferred_slot_start', 'preferred_slot_end', 'coupon_code'
  )
ORDER BY column_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 
  '✅ DATABASE SETUP COMPLETE!' as status,
  'All tables created and data inserted' as message,
  'You can now create leads with full functionality' as next_step;

