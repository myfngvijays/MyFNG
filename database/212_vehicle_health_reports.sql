-- Migration 212: Store Smart Health Checkup reports from mobile app

CREATE TABLE IF NOT EXISTS public.vehicle_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  fuel TEXT,
  registration_year INTEGER,
  odometer INTEGER,
  composite_score INTEGER NOT NULL,
  band_label TEXT,
  accuracy TEXT,
  report_json JSONB NOT NULL,
  report_text TEXT NOT NULL,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_health_reports_reg ON public.vehicle_health_reports(reg_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_health_reports_created ON public.vehicle_health_reports(created_at DESC);

COMMENT ON TABLE public.vehicle_health_reports IS 'Smart Health Checkup reports generated from the MyFNG mobile app';
