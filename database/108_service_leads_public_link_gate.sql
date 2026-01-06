-- =====================================================
-- 108: Gate customer public link until advisor enables it
-- Adds:
--  - service_leads.customer_public_enabled (bool)
--  - service_leads.customer_public_enabled_at (timestamptz)
--  - service_leads.customer_public_enabled_by (uuid -> users_login)
-- =====================================================

BEGIN;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS customer_public_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS customer_public_enabled_at timestamp with time zone NULL;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS customer_public_enabled_by uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'service_leads'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'service_leads_customer_public_enabled_by_fkey'
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_customer_public_enabled_by_fkey
      FOREIGN KEY (customer_public_enabled_by)
      REFERENCES public.users_login (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_leads_customer_public_enabled
  ON public.service_leads (customer_public_enabled);

COMMIT;


