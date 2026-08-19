-- 317: Lead Manager ops — tags, saved views, WhatsApp DND
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.crm_lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#004AAD',
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_lead_tags_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.crm_lead_tag_map (
  lead_id uuid NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_lead_tags(id) ON DELETE CASCADE,
  tagged_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_tag_map_tag ON public.crm_lead_tag_map (tag_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_tag_map_lead ON public.crm_lead_tag_map (lead_id);

CREATE TABLE IF NOT EXISTS public.crm_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  is_shared boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_saved_views_owner ON public.crm_saved_views (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_shared ON public.crm_saved_views (is_shared) WHERE is_shared = true;

CREATE TABLE IF NOT EXISTS public.whatsapp_dnd_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  phone_last10 text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_dnd_phone_unique UNIQUE (phone_last10)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dnd_e164 ON public.whatsapp_dnd_numbers (phone_e164);

COMMENT ON TABLE public.crm_lead_tags IS 'CRM tags for segmentation (Lead Manager / Admin)';
COMMENT ON TABLE public.crm_saved_views IS 'Saved lead filter views; is_shared=true visible to team';
COMMENT ON TABLE public.whatsapp_dnd_numbers IS 'WhatsApp opt-out / DND — skip bulk & campaign sends';
