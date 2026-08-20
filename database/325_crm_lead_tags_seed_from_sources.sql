-- Seed CRM lead tags from known lead sources (admin / distribution channels).
-- Safe to re-run — skips names that already exist (case-insensitive).

CREATE TABLE IF NOT EXISTS public.crm_lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#004AAD',
  created_by uuid REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_lead_tags_name_unique UNIQUE (name)
);

INSERT INTO public.crm_lead_tags (name, color)
SELECT v.name, v.color
FROM (
  VALUES
    ('Website', '#BFDBFE'),
    ('App Booking', '#BBF7D0'),
    ('App Booking (Cart)', '#A7F3D0'),
    ('Google Ads', '#FED7AA'),
    ('Instagram Ads', '#FBCFE8'),
    ('WhatsApp', '#99F6E4'),
    ('MISA', '#DDD6FE'),
    ('MISA OTP Verified', '#C7D2FE'),
    ('Facebook Ads', '#E9D5FF'),
    ('Banner/Offline', '#FEF08A'),
    ('Reference', '#FDE68A'),
    ('Partner', '#FECACA'),
    ('Other', '#F1F5F9')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = lower(btrim(v.name))
);

-- Also seed any distinct lead_source values already on service_leads
INSERT INTO public.crm_lead_tags (name, color)
SELECT DISTINCT
  btrim(s.lead_source) AS name,
  (ARRAY[
    '#DDD6FE', '#BFDBFE', '#FECACA', '#BBF7D0', '#FED7AA', '#FBCFE8',
    '#A5F3FC', '#FEF08A', '#C7D2FE', '#99F6E4', '#FDE68A', '#E9D5FF'
  ])[
    1 + (abs(hashtext(lower(btrim(s.lead_source)))) % 12)
  ]
FROM public.service_leads s
WHERE s.lead_source IS NOT NULL
  AND btrim(s.lead_source) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_tags t
    WHERE lower(btrim(t.name)) = lower(btrim(s.lead_source))
  );

COMMENT ON TABLE public.crm_lead_tags IS
  'CRM tags for segmentation (Lead Manager / Admin); seeded from lead sources';
