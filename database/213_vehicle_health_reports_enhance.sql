-- Migration 213: Customer identity & platform on health check reports

ALTER TABLE public.vehicle_health_reports
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS platform VARCHAR(10),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_health_reports_platform
  ON public.vehicle_health_reports(platform);

CREATE INDEX IF NOT EXISTS idx_vehicle_health_reports_customer_phone
  ON public.vehicle_health_reports(customer_phone);

CREATE INDEX IF NOT EXISTS idx_vehicle_health_reports_customer_id
  ON public.vehicle_health_reports(customer_id);

COMMENT ON COLUMN public.vehicle_health_reports.customer_name IS 'App customer full name when available';
COMMENT ON COLUMN public.vehicle_health_reports.platform IS 'ANDROID or IOS';
