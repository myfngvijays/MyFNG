-- Migration 211: Add insurance_expiry column to customer_vehicles
-- Allows storing insurance expiry date entered from the My Profile screen

ALTER TABLE public.customer_vehicles
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE;

COMMENT ON COLUMN public.customer_vehicles.insurance_expiry IS 'Vehicle insurance expiry date (YYYY-MM-DD)';

CREATE INDEX IF NOT EXISTS idx_customer_vehicles_insurance_expiry
  ON public.customer_vehicles(insurance_expiry)
  WHERE insurance_expiry IS NOT NULL;
