-- 🔥 GUARANTEED FIX FOR service_leads TABLE
-- This will add ALL missing columns with proper data types
-- Safe to run multiple times (uses IF NOT EXISTS)

DO $$ 
BEGIN
  RAISE NOTICE '🔥 Starting Guaranteed Fix for service_leads table...';
END $$;

-- 1. Add workshop_id (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL;

-- 2. Add is_incomplete (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS is_incomplete BOOLEAN DEFAULT false;

-- 3. Add reopen_count (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0;

-- 4. Add sla_state (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS sla_state VARCHAR(20) CHECK (sla_state IN ('NORMAL', 'AT_RISK', 'BREACHED', 'PAUSED'));

-- 5. Add sla_expires_at (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS sla_expires_at TIMESTAMPTZ;

-- 6. Add follow_up_required (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false;

-- 7. Add pickup_required (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS pickup_required BOOLEAN DEFAULT false;

-- 8. Add pickup_status (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(20) CHECK (pickup_status IN ('PENDING', 'ASSIGNED', 'PICKED_UP', 'CANCELLED'));

-- 9. Add assigned_telecaller_id (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS assigned_telecaller_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL;

-- 10. Add escalation (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS escalation JSONB DEFAULT '[]'::jsonb;

-- 11. Add city_id (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;

-- 12. Add model_id (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.vehicle_models(id) ON DELETE SET NULL;

-- 13. Add assigned_by (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL;

-- 14. Add created_from (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS created_from VARCHAR(50) CHECK (created_from IN ('WEB', 'MOBILE', 'API', 'IMPORT', 'TELECALLER'));

-- 15. Add lead_priority (if missing)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS lead_priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (lead_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));

DO $$ 
BEGIN
  RAISE NOTICE '✅ All critical columns added to service_leads table!';
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_id ON public.service_leads(workshop_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_is_incomplete ON public.service_leads(is_incomplete) WHERE is_incomplete = true;
CREATE INDEX IF NOT EXISTS idx_service_leads_reopen_count ON public.service_leads(reopen_count) WHERE reopen_count > 0;
CREATE INDEX IF NOT EXISTS idx_service_leads_sla_state ON public.service_leads(sla_state);
CREATE INDEX IF NOT EXISTS idx_service_leads_sla_expires_at ON public.service_leads(sla_expires_at) WHERE sla_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_telecaller ON public.service_leads(assigned_telecaller_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_city_id ON public.service_leads(city_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_model_id ON public.service_leads(model_id);

DO $$ 
BEGIN
  RAISE NOTICE '✅ All indexes created!';
END $$;

-- Force refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

DO $$ 
BEGIN
  RAISE NOTICE '🎯 PostgREST cache refreshed!';
  RAISE NOTICE '✅ GUARANTEED FIX COMPLETE - Please refresh your browser!';
END $$;

