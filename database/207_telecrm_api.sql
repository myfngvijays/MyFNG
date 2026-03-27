-- =====================================================
-- Migration: TeleCRM API table
-- Purpose: Store leads pushed/received from TeleCRM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.telecrm_api (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  mobile TEXT,
  city TEXT,
  pincode TEXT,
  disposition TEXT,
  disposition_category TEXT,
  service_type TEXT,
  vehicle_number TEXT,
  state TEXT,
  vehicle_model TEXT,
  customer_quoted_amount NUMERIC,
  location_link TEXT,
  recording_url TEXT,
  disposition_note TEXT,
  api_response JSONB,
  api_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telecrm_api_mobile ON public.telecrm_api(mobile);
CREATE INDEX IF NOT EXISTS idx_telecrm_api_disposition ON public.telecrm_api(disposition);
CREATE INDEX IF NOT EXISTS idx_telecrm_api_city ON public.telecrm_api(city);
CREATE INDEX IF NOT EXISTS idx_telecrm_api_created_at ON public.telecrm_api(created_at DESC);

ALTER TABLE public.telecrm_api ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage telecrm_api" ON public.telecrm_api;
CREATE POLICY "Admins can manage telecrm_api" ON public.telecrm_api
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

DO $$
BEGIN
  RAISE NOTICE '✅ telecrm_api table created with RLS';
END $$;
