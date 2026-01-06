-- =====================================================
-- 106: Additional Jobs Master - Labour Rates by Fuel + Car Class
-- Purpose:
--  - Store labour price matrix per additional job:
--      (additional_job_id, fuel_type, car_class) -> labour_price
--  - Keep additional_jobs_master.labour_price as default fallback
--  - Apply RLS similar to additional_jobs_master
-- =====================================================

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.additional_jobs_master_labour_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  additional_job_id UUID NOT NULL REFERENCES public.additional_jobs_master(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20) NOT NULL,
  car_class VARCHAR(100) NOT NULL,
  labour_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique constraint to support upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'additional_jobs_master_labour_rates_unique_key'
  ) THEN
    ALTER TABLE public.additional_jobs_master_labour_rates
      ADD CONSTRAINT additional_jobs_master_labour_rates_unique_key
      UNIQUE (additional_job_id, fuel_type, car_class);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ajm_labour_rates_additional_job_id
  ON public.additional_jobs_master_labour_rates(additional_job_id);

CREATE INDEX IF NOT EXISTS idx_ajm_labour_rates_fuel_class
  ON public.additional_jobs_master_labour_rates(fuel_type, car_class);

-- Updated_at trigger (best-effort; only if trigger function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_ajm_labour_rates_updated_at ON public.additional_jobs_master_labour_rates;
    CREATE TRIGGER trg_ajm_labour_rates_updated_at
    BEFORE UPDATE ON public.additional_jobs_master_labour_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 2) RLS
ALTER TABLE public.additional_jobs_master_labour_rates ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "AJM Labour: authenticated can view" ON public.additional_jobs_master_labour_rates;
DROP POLICY IF EXISTS "AJM Labour: super admin manage" ON public.additional_jobs_master_labour_rates;
DROP POLICY IF EXISTS "AJM Labour: workshop manage" ON public.additional_jobs_master_labour_rates;

-- View: any authenticated user can view rows for non-deleted AJM rows
CREATE POLICY "AJM Labour: authenticated can view" ON public.additional_jobs_master_labour_rates
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.additional_jobs_master ajm
    WHERE ajm.id = additional_jobs_master_labour_rates.additional_job_id
      AND ajm.deleted_at IS NULL
  )
);

-- Super Admin: can do anything
CREATE POLICY "AJM Labour: super admin manage" ON public.additional_jobs_master_labour_rates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Workshop Admin / Supervisor: manage only their workshop AJM rows
CREATE POLICY "AJM Labour: workshop manage" ON public.additional_jobs_master_labour_rates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    JOIN public.additional_jobs_master ajm ON ajm.id = additional_jobs_master_labour_rates.additional_job_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND ul.workshop_id IS NOT NULL
      AND ajm.workshop_id IS NOT NULL
      AND ul.workshop_id = ajm.workshop_id
      AND ajm.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    JOIN public.additional_jobs_master ajm ON ajm.id = additional_jobs_master_labour_rates.additional_job_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND ul.workshop_id IS NOT NULL
      AND ajm.workshop_id IS NOT NULL
      AND ul.workshop_id = ajm.workshop_id
      AND ajm.deleted_at IS NULL
  )
);

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ additional_jobs_master_labour_rates created/updated + RLS policies applied';
END $$;


