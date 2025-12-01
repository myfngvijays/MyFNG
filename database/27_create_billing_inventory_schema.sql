-- =====================================================
-- MIGRATION: Advanced Billing, Inventory & Zone Pricing
-- Purpose: Implement Zones, Master Products, Packages, and Item-level Tax tracking
-- =====================================================

-- =====================================================
-- 1. Create ZONES Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert Default Zones
INSERT INTO public.zones (name, description) VALUES
('North Zone', 'Northern Region'),
('South Zone', 'Southern Region'),
('East Zone', 'Eastern Region'),
('West Zone', 'Western Region'),
('Central Zone', 'Central Region'),
('Metro Cities', 'Major Metropolitan Cities')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. Update WORKSHOPS Table
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workshops' AND column_name = 'zone_id') THEN
        ALTER TABLE public.workshops ADD COLUMN zone_id UUID REFERENCES public.zones(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workshops_zone_id ON public.workshops(zone_id);

-- =====================================================
-- 3. Create MASTER PRODUCTS Table
-- =====================================================
-- This serves as the global catalog for Parts and Consumables
CREATE TABLE IF NOT EXISTS public.master_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('PART', 'LABOUR', 'CONSUMABLE')),
  category VARCHAR(100),
  
  -- Pricing & Tax
  hsn_sac_code VARCHAR(20),
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00, -- GST Rate (e.g., 18)
  unit VARCHAR(50) DEFAULT 'pc', -- pc, ltr, set, etc.
  
  manufacturer VARCHAR(100),
  part_number VARCHAR(100),
  compatible_models JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_products_type ON public.master_products(type);
CREATE INDEX IF NOT EXISTS idx_master_products_hsn ON public.master_products(hsn_sac_code);

-- =====================================================
-- 4. Create SERVICE PACKAGES Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.00,
  hsn_sac_code VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Package Items Link Table
CREATE TABLE IF NOT EXISTS public.service_package_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  
  -- Can link to either a Product (Part) or a Service Type
  product_id UUID REFERENCES public.master_products(id),
  service_type_id UUID REFERENCES public.service_types(id),
  
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT check_package_item_reference CHECK (
    (product_id IS NOT NULL AND service_type_id IS NULL) OR
    (product_id IS NULL AND service_type_id IS NOT NULL)
  )
);

-- =====================================================
-- 5. Create WORKSHOP PRODUCT PRICING Table (Overrides)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workshop_product_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.master_products(id) ON DELETE CASCADE,
  
  selling_price NUMERIC(12,2) NOT NULL, -- Workshop specific price
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(workshop_id, product_id)
);

-- =====================================================
-- 6. Update SERVICE TYPES & ADDONS (Master Services)
-- =====================================================
DO $$
BEGIN
    -- Update service_types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_types' AND column_name = 'hsn_sac_code') THEN
        ALTER TABLE public.service_types ADD COLUMN hsn_sac_code VARCHAR(20);
        ALTER TABLE public.service_types ADD COLUMN default_tax_rate NUMERIC(5,2) DEFAULT 18.00;
    END IF;

    -- Update service_addons
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_addons' AND column_name = 'hsn_sac_code') THEN
        ALTER TABLE public.service_addons ADD COLUMN hsn_sac_code VARCHAR(20);
        ALTER TABLE public.service_addons ADD COLUMN default_tax_rate NUMERIC(5,2) DEFAULT 18.00;
    END IF;
END $$;

-- =====================================================
-- 7. Update JOB CARD PARTS (For Invoice Generation)
-- =====================================================
-- Adding granular tax columns for accurate billing
DO $$
BEGIN
    -- Pricing Details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_card_parts' AND column_name = 'hsn_sac_code') THEN
        ALTER TABLE public.job_card_parts ADD COLUMN hsn_sac_code VARCHAR(20);
        ALTER TABLE public.job_card_parts ADD COLUMN tax_rate NUMERIC(5,2) DEFAULT 0; -- e.g. 18.00
        ALTER TABLE public.job_card_parts ADD COLUMN taxable_amount NUMERIC(12,2) DEFAULT 0; -- (Unit Price * Qty) before tax
        
        -- CGST
        ALTER TABLE public.job_card_parts ADD COLUMN cgst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.job_card_parts ADD COLUMN cgst_amount NUMERIC(12,2) DEFAULT 0;
        
        -- SGST
        ALTER TABLE public.job_card_parts ADD COLUMN sgst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.job_card_parts ADD COLUMN sgst_amount NUMERIC(12,2) DEFAULT 0;
        
        -- IGST
        ALTER TABLE public.job_card_parts ADD COLUMN igst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.job_card_parts ADD COLUMN igst_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    
    -- Link to Master Product (Optional, for tracking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_card_parts' AND column_name = 'product_id') THEN
        ALTER TABLE public.job_card_parts ADD COLUMN product_id UUID REFERENCES public.master_products(id);
    END IF;
END $$;

-- =====================================================
-- 8. Update LEAD PRICING ITEMS (For Invoice Generation)
-- =====================================================
-- This table stores Services & Labour charges
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_pricing_items' AND column_name = 'hsn_sac_code') THEN
        ALTER TABLE public.lead_pricing_items ADD COLUMN hsn_sac_code VARCHAR(20);
        ALTER TABLE public.lead_pricing_items ADD COLUMN tax_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.lead_pricing_items ADD COLUMN taxable_amount NUMERIC(12,2) DEFAULT 0;
        
        -- CGST
        ALTER TABLE public.lead_pricing_items ADD COLUMN cgst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.lead_pricing_items ADD COLUMN cgst_amount NUMERIC(12,2) DEFAULT 0;
        
        -- SGST
        ALTER TABLE public.lead_pricing_items ADD COLUMN sgst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.lead_pricing_items ADD COLUMN sgst_amount NUMERIC(12,2) DEFAULT 0;
        
        -- IGST
        ALTER TABLE public.lead_pricing_items ADD COLUMN igst_rate NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE public.lead_pricing_items ADD COLUMN igst_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- 9. Enable RLS on New Tables
-- =====================================================
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_product_pricing ENABLE ROW LEVEL SECURITY;

-- Create Basic Policies (Open for MVP, restrict later)
CREATE POLICY "Authenticated users can view zones" ON public.zones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view products" ON public.master_products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view packages" ON public.service_packages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view package items" ON public.service_package_items FOR SELECT USING (auth.role() = 'authenticated');

-- Workshop Pricing Policy
CREATE POLICY "Workshop admins can manage their pricing" ON public.workshop_product_pricing
USING (
  workshop_id IN (
    SELECT workshop_id FROM users_login WHERE id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 10. Seed Some Master Products (Initial Data)
-- =====================================================
INSERT INTO public.master_products (name, type, category, hsn_sac_code, default_price, tax_rate, unit)
VALUES 
('10W40 Shell Engine Oil', 'PART', 'Lubricants', '2710', 654.00, 18.00, 'Ltr'),
('Oil Filter 1006', 'PART', 'Filters', '8421', 114.00, 18.00, 'pc'),
('Rust Off Formula', 'CONSUMABLE', 'Cleaning', '3403', 250.00, 18.00, 'pc'),
('Screen Wash', 'CONSUMABLE', 'Cleaning', '3402', 18.00, 18.00, 'pc'),
('Teflon Material', 'CONSUMABLE', 'Polishing', '3405', 18.00, 18.00, 'pc'),
('Caliper Grease', 'CONSUMABLE', 'Lubricants', '2710', 25.00, 18.00, 'pc'),
('Cam Bolt', 'PART', 'Fasteners', '7318', 125.00, 18.00, 'pc'),
('Cam Bolt Washer', 'PART', 'Fasteners', '7318', 25.00, 18.00, 'pc')
ON CONFLICT DO NOTHING;

-- =====================================================
-- Success Notification
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Billing & Inventory Schema Migration Completed Successfully!';
END $$;

