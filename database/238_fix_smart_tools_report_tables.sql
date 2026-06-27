-- Migration 238: Fix car_resale_valuations and vehicle_health_reports for reliable inserts
-- Issue: model_id UUID type causes insert failures when car_models uses non-UUID IDs

-- Alter model_id to TEXT (nullable) if column exists as UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_resale_valuations'
      AND column_name = 'model_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.car_resale_valuations ALTER COLUMN model_id TYPE TEXT USING model_id::TEXT;
    ALTER TABLE public.car_resale_valuations ALTER COLUMN model_id DROP NOT NULL;
  END IF;
END $$;

-- Ensure RLS allows service role inserts (public insert for mobile app submissions)
ALTER TABLE IF EXISTS public.car_resale_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_health_reports ENABLE ROW LEVEL SECURITY;

-- Allow service_role (used by API) to insert/read freely — bypass RLS
-- These are no-ops if policies already exist
DO $$
BEGIN
  -- car_resale_valuations: allow public inserts (mobile app) + admin reads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'car_resale_valuations' AND policyname = 'Service role full access resale'
  ) THEN
    CREATE POLICY "Service role full access resale" ON public.car_resale_valuations
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- vehicle_health_reports: allow public inserts (mobile app) + admin reads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_health_reports' AND policyname = 'Service role full access health'
  ) THEN
    CREATE POLICY "Service role full access health" ON public.vehicle_health_reports
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
