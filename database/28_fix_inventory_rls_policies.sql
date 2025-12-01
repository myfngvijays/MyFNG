-- =====================================================
-- FIX RLS POLICIES for Inventory Tables
-- Purpose: Allow Super Admins to Insert/Update/Delete Zones, Products, Packages
-- =====================================================

-- =====================================================
-- 1. ZONES
-- =====================================================
DROP POLICY IF EXISTS "Super admins can manage zones" ON public.zones;
CREATE POLICY "Super admins can manage zones" ON public.zones
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 2. MASTER PRODUCTS
-- =====================================================
DROP POLICY IF EXISTS "Super admins can manage products" ON public.master_products;
CREATE POLICY "Super admins can manage products" ON public.master_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 3. SERVICE PACKAGES
-- =====================================================
DROP POLICY IF EXISTS "Super admins can manage packages" ON public.service_packages;
CREATE POLICY "Super admins can manage packages" ON public.service_packages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 4. SERVICE PACKAGE ITEMS
-- =====================================================
DROP POLICY IF EXISTS "Super admins can manage package items" ON public.service_package_items;
CREATE POLICY "Super admins can manage package items" ON public.service_package_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- =====================================================
-- 5. WORKSHOP PRODUCT PRICING
-- =====================================================
-- Allow Super Admin to manage ALL pricing overrides
DROP POLICY IF EXISTS "Super admins can manage pricing" ON public.workshop_product_pricing;
CREATE POLICY "Super admins can manage pricing" ON public.workshop_product_pricing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ Inventory RLS Policies Updated for Super Admin Access!';
END $$;

