-- Extra lead fields a manager or admin can add. Built-in booking columns stay in code.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.crm_lead_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_custom_fields_name_lower_uidx
  ON public.crm_lead_custom_fields (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_crm_lead_custom_fields_active_sort
  ON public.crm_lead_custom_fields (is_active, sort_order, name);

COMMENT ON TABLE public.crm_lead_custom_fields IS
  'Custom lead fields added from Lead Fields. Values live on service_leads.coupon_meta.custom_fields.';
