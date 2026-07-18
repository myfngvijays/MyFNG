-- Car loan leads: store full name + loan amount in MyFNG CRM (Supabase)

ALTER TABLE public.car_loan_leads
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS loan_amount NUMERIC(12, 2);

COMMENT ON COLUMN public.car_loan_leads.full_name IS 'Applicant full name from car-loan form';
COMMENT ON COLUMN public.car_loan_leads.loan_amount IS 'Desired loan amount (INR) from car-loan form';
