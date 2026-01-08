-- Add supervisor observation fields to service_leads table
-- These fields are separate from pickup_observation (which is for pickup boy)

-- Add supervisor observation fields
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS supervisor_observation text NULL,
  ADD COLUMN IF NOT EXISTS supervisor_observation_updated_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS supervisor_observation_by uuid NULL;

-- Add foreign key constraint for supervisor_observation_by
ALTER TABLE public.service_leads
  ADD CONSTRAINT service_leads_supervisor_observation_by_fkey 
  FOREIGN KEY (supervisor_observation_by) 
  REFERENCES users_login (id) 
  ON DELETE SET NULL;

-- Add index for supervisor_observation_by for better query performance
CREATE INDEX IF NOT EXISTS idx_service_leads_supervisor_observation_by 
  ON public.service_leads (supervisor_observation_by) 
  TABLESPACE pg_default;

-- Add index for supervisor_observation_updated_at for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_service_leads_supervisor_observation_updated_at 
  ON public.service_leads (supervisor_observation_updated_at) 
  TABLESPACE pg_default
  WHERE supervisor_observation_updated_at IS NOT NULL;
