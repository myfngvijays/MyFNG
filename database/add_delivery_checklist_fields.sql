-- Add delivery checklist fields to service_leads table
-- These fields track the delivery preparation checklist items

-- Add delivery checklist fields
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS delivery_invoice_ready boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_car_washed boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_paperwork_complete boolean NULL DEFAULT false;

-- Add index for filtering jobs by checklist completion status
CREATE INDEX IF NOT EXISTS idx_service_leads_delivery_checklist
  ON public.service_leads (delivery_invoice_ready, delivery_car_washed, delivery_paperwork_complete)
  TABLESPACE pg_default
  WHERE delivery_invoice_ready = true OR delivery_car_washed = true OR delivery_paperwork_complete = true;

-- Add comment to document the fields
COMMENT ON COLUMN public.service_leads.delivery_invoice_ready IS 'Indicates if invoice is ready for delivery';
COMMENT ON COLUMN public.service_leads.delivery_car_washed IS 'Indicates if car has been washed before delivery';
COMMENT ON COLUMN public.service_leads.delivery_paperwork_complete IS 'Indicates if all paperwork is complete for delivery';
