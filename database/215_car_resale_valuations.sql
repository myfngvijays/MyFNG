-- Migration 215: Store Car Resale Value estimates from mobile app

CREATE TABLE IF NOT EXISTS public.car_resale_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT,
  model TEXT,
  model_id UUID,
  vehicle_class TEXT,
  vehicle_number TEXT,
  registration_year INTEGER,
  fuel TEXT,
  transmission TEXT,
  odometer INTEGER,
  owners INTEGER,
  condition TEXT,
  had_accident BOOLEAN DEFAULT false,
  insurance_valid BOOLEAN,
  service_records TEXT,
  city_name TEXT,
  city_tier TEXT,
  estimate_low INTEGER NOT NULL,
  estimate_mid INTEGER NOT NULL,
  estimate_high INTEGER NOT NULL,
  valuation_json JSONB NOT NULL,
  valuation_text TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  platform VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_resale_valuations_created ON public.car_resale_valuations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_resale_valuations_make ON public.car_resale_valuations(make);
CREATE INDEX IF NOT EXISTS idx_car_resale_valuations_platform ON public.car_resale_valuations(platform);
CREATE INDEX IF NOT EXISTS idx_car_resale_valuations_customer_phone ON public.car_resale_valuations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_car_resale_valuations_customer_id ON public.car_resale_valuations(customer_id);

COMMENT ON TABLE public.car_resale_valuations IS 'Car Resale Value estimates from the MyFNG mobile Smart Tools app';
