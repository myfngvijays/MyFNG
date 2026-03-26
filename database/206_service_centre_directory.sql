-- =====================================================
-- Migration: Service Centre Directory
-- Purpose: Master directory of service centres for CSV upload + RSA_MANAGER read access
-- =====================================================

-- 1) Create table with columns matching CSV headers for direct upload
CREATE TABLE IF NOT EXISTS public.service_centre_directory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location TEXT,
  weekoff TEXT,
  workshop_timing TEXT,
  categories TEXT,
  active TEXT,
  workshop_area TEXT,
  original_loc TEXT,
  service_centre_real_name TEXT,
  address TEXT,
  landmark TEXT,
  contect_person TEXT,
  alternate TEXT,
  alternate2 TEXT,
  alternate3 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_centre_directory_location
  ON public.service_centre_directory(location);

CREATE INDEX IF NOT EXISTS idx_service_centre_directory_active
  ON public.service_centre_directory(active);

CREATE INDEX IF NOT EXISTS idx_service_centre_directory_workshop_area
  ON public.service_centre_directory(workshop_area);

-- 2) Enable RLS
ALTER TABLE public.service_centre_directory ENABLE ROW LEVEL SECURITY;

-- 3) Admins (SUPER_ADMIN / SUB_ADMIN) can do everything (INSERT/UPDATE/DELETE via dashboard + CSV upload)
DROP POLICY IF EXISTS "Admins can manage service_centre_directory" ON public.service_centre_directory;
CREATE POLICY "Admins can manage service_centre_directory" ON public.service_centre_directory
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid()
           OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
           OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid()
           OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
           OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- 4) RSA_MANAGER can READ all rows
DROP POLICY IF EXISTS "RSA managers can read service_centre_directory" ON public.service_centre_directory;
CREATE POLICY "RSA managers can read service_centre_directory" ON public.service_centre_directory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (ul.id = auth.uid()
           OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
           OR ul.phone = (auth.jwt() ->> 'phone'))
    AND r.role_code IN ('RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ service_centre_directory table created with RLS for RSA_MANAGER read access';
END $$;
