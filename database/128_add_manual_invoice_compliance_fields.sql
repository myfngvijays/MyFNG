-- Add GST/compliance fields for manual invoices
ALTER TABLE IF EXISTS public.manual_create_invoice
  ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_tax_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100),
  ADD COLUMN IF NOT EXISTS car_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS car_model VARCHAR(80);
