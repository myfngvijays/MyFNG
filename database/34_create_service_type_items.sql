-- =====================================================
-- MIGRATION: Link Products to Service Types (Packages)
-- Purpose: Treat 'service_types' as Packages and allow mapping products to them
-- =====================================================

-- 1. Create SERVICE_TYPE_ITEMS table
-- This replaces the old 'service_package_items' concept
CREATE TABLE IF NOT EXISTS public.service_type_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.master_products(id),
  
  quantity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Prevent duplicate product mapping for same service
  UNIQUE(service_type_id, product_id)
);

-- 2. Enable RLS
ALTER TABLE public.service_type_items ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view service items" ON public.service_type_items;
CREATE POLICY "Authenticated users can view service items" ON public.service_type_items
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admins can manage service items" ON public.service_type_items;
CREATE POLICY "Super admins can manage service items" ON public.service_type_items
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
    RAISE NOTICE '✅ Service Type Items table created successfully!';
END $$;

