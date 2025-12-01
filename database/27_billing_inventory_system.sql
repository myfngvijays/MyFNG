-- =====================================================
-- MIGRATION: Advanced Billing & Inventory System
-- Purpose: Add Zones, Master Products, Service Packages, and GST support
-- =====================================================

-- =====================================================
-- 1. Create Zones Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add zone_id to workshops table
ALTER TABLE public.workshops
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id);

CREATE INDEX IF NOT EXISTS idx_workshops_zone_id ON public.workshops(zone_id);

-- =====================================================
-- 2. Create Master Products Table (Parts & Consumables)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.master_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('PART', 'LABOUR', 'CONSUMABLE', 'SERVICE')),
  category VARCHAR(100),
  hsn_sac_code VARCHAR(20),
  description TEXT,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00, -- GST Rate (e.g., 18, 12, 5)
  unit VARCHAR(20) DEFAULT 'PIECE', -- PIECE, LITRE, SET, KIT
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_products_type ON public.master_products(type);
CREATE INDEX IF NOT EXISTS idx_master_products_hsn ON public.master_products(hsn_sac_code);

-- =====================================================
-- 3. Create Service Packages Table (Bundles)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link table for package items
CREATE TABLE IF NOT EXISTS public.service_package_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  
  -- Can link to either a product or a service type
  product_id UUID REFERENCES public.master_products(id),
  service_type_id UUID REFERENCES public.service_types(id), -- Existing table
  
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price_in_package NUMERIC(10,2), -- Override price if part of package
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON public.service_package_items(package_id);

-- =====================================================
-- 4. Workshop Product Pricing (Overrides)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workshop_product_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.master_products(id) ON DELETE CASCADE,
  selling_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workshop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_workshop_pricing_product ON public.workshop_product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_workshop_pricing_workshop ON public.workshop_product_pricing(workshop_id);

-- =====================================================
-- 5. Enhance Existing Tables with Tax Columns
-- =====================================================

-- A. service_types (Add HSN & Default Tax)
ALTER TABLE public.service_types
ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) DEFAULT 18.00;

-- B. service_addons (Add HSN & Default Tax)
ALTER TABLE public.service_addons
ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) DEFAULT 18.00;

-- C. job_card_parts (Store snapshot of tax info)
ALTER TABLE public.job_card_parts
ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(10,2) DEFAULT 0, -- (Unit Price * Qty)
ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(10,2) DEFAULT 0;

-- D. lead_pricing_items (Store snapshot of tax info for audit/billing)
ALTER TABLE public.lead_pricing_items
ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(10,2) DEFAULT 0;

-- =====================================================
-- 6. RLS Policies for New Tables
-- =====================================================

-- Enable RLS
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_product_pricing ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active zones
CREATE POLICY "Everyone can view zones" ON public.zones FOR SELECT USING (true);
-- Policy: Only Super Admin can manage zones
CREATE POLICY "Super Admin manage zones" ON public.zones FOR ALL USING (
  EXISTS (SELECT 1 FROM users_login ul JOIN roles r ON ul.role_id = r.id 
  WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN')
);

-- Policy: Everyone can view active master products
CREATE POLICY "Everyone can view master products" ON public.master_products FOR SELECT USING (true);
-- Policy: Only Super Admin can manage master products
CREATE POLICY "Super Admin manage master products" ON public.master_products FOR ALL USING (
  EXISTS (SELECT 1 FROM users_login ul JOIN roles r ON ul.role_id = r.id 
  WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN')
);

-- Policy: Everyone can view packages
CREATE POLICY "Everyone can view packages" ON public.service_packages FOR SELECT USING (true);
CREATE POLICY "Everyone can view package items" ON public.service_package_items FOR SELECT USING (true);

-- Policy: Workshop pricing
CREATE POLICY "Workshops can view their own pricing" ON public.workshop_product_pricing 
FOR SELECT USING (
  workshop_id IN (SELECT workshop_id FROM users_login WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM users_login ul JOIN roles r ON ul.role_id = r.id 
  WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN')
);

CREATE POLICY "Super Admin manage workshop pricing" ON public.workshop_product_pricing 
FOR ALL USING (
  EXISTS (SELECT 1 FROM users_login ul JOIN roles r ON ul.role_id = r.id 
  WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN')
);

-- =====================================================
-- 7. Seed Data (Initial Zones & Common Products)
-- =====================================================
INSERT INTO public.zones (name, description) VALUES
('North Zone', 'Delhi, NCR, Punjab, Haryana'),
('South Zone', 'Karnataka, Tamil Nadu, Kerala'),
('West Zone', 'Maharashtra, Gujarat'),
('East Zone', 'West Bengal, Odisha, Bihar');

-- Insert some common parts
INSERT INTO public.master_products (name, type, hsn_sac_code, default_price, tax_rate, unit, category) VALUES
('Engine Oil 5W30', 'PART', '2710', 1200.00, 18.00, 'LITRE', 'Lubricants'),
('Oil Filter', 'PART', '8421', 150.00, 18.00, 'PIECE', 'Filters'),
('Air Filter', 'PART', '8421', 350.00, 18.00, 'PIECE', 'Filters'),
('Brake Pads (Front)', 'PART', '8708', 1800.00, 28.00, 'SET', 'Brakes'),
('Coolant', 'PART', '3820', 300.00, 18.00, 'LITRE', 'Lubricants'),
('Clutch Plate', 'PART', '8708', 3500.00, 28.00, 'PIECE', 'Transmission'),
('General Service Labour', 'LABOUR', '9987', 800.00, 18.00, 'JOB', 'Service');

-- Update existing service types with HSN
UPDATE public.service_types SET hsn_sac_code = '9987', default_tax_rate = 18.00;
UPDATE public.service_addons SET hsn_sac_code = '9987', default_tax_rate = 18.00;

-- =====================================================
-- End of Migration
-- =====================================================

