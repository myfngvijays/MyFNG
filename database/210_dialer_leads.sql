-- =====================================================
-- Migration: Dialer Leads table + Storage bucket
-- Purpose: Store disposition data received from local dialer
-- =====================================================

-- 1. Create the dialer_leads table
CREATE TABLE IF NOT EXISTS public.dialer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_no TEXT NOT NULL,
  name TEXT,
  address TEXT,
  regdate TEXT,
  car_number TEXT,
  make TEXT,
  model TEXT,
  disposition TEXT,
  remark TEXT,
  dialer_id TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dialer_leads_phone_no ON public.dialer_leads(phone_no);
CREATE INDEX IF NOT EXISTS idx_dialer_leads_dialer_id ON public.dialer_leads(dialer_id);
CREATE INDEX IF NOT EXISTS idx_dialer_leads_disposition ON public.dialer_leads(disposition);
CREATE INDEX IF NOT EXISTS idx_dialer_leads_created_at ON public.dialer_leads(created_at DESC);

ALTER TABLE public.dialer_leads ENABLE ROW LEVEL SECURITY;

-- Allow the service_role (API) to insert without auth
DROP POLICY IF EXISTS "Service role full access on dialer_leads" ON public.dialer_leads;
CREATE POLICY "Service role full access on dialer_leads" ON public.dialer_leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can read/manage via dashboard
DROP POLICY IF EXISTS "Admins can manage dialer_leads" ON public.dialer_leads;
CREATE POLICY "Admins can manage dialer_leads" ON public.dialer_leads
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

-- 2. Create the dialer-recordings storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dialer-recordings',
  'dialer-recordings',
  true,
  52428800, -- 50MB file size limit for audio recordings
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/amr', 'video/mp4', 'video/webm', 'video/3gpp', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/amr', 'video/mp4', 'video/webm', 'video/3gpp', 'application/octet-stream'];

-- Storage: anyone can view recordings (public bucket)
DROP POLICY IF EXISTS "Anyone can view dialer recordings" ON storage.objects;
CREATE POLICY "Anyone can view dialer recordings"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dialer-recordings');

-- Storage: service_role can upload recordings
DROP POLICY IF EXISTS "Service role can upload dialer recordings" ON storage.objects;
CREATE POLICY "Service role can upload dialer recordings"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'dialer-recordings');

DO $$
BEGIN
  RAISE NOTICE 'dialer_leads table and dialer-recordings bucket created with RLS';
END $$;
