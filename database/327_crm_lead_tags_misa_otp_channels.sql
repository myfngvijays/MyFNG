-- Segregate MISA OTP Verified into WhatsApp / Website / App child tags.
-- Parent: "MISA OTP Verified" (common). Children applied with parent on OTP verify.
-- Safe to re-run.

ALTER TABLE public.crm_lead_tags
  ADD COLUMN IF NOT EXISTS parent_tag_id uuid REFERENCES public.crm_lead_tags(id) ON DELETE SET NULL;

-- Ensure parent exists (may already be seeded by 325)
INSERT INTO public.crm_lead_tags (name, color)
SELECT 'MISA OTP Verified', '#C7D2FE'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = 'misa otp verified'
);

-- Channel children
WITH parent AS (
  SELECT id FROM public.crm_lead_tags
  WHERE lower(btrim(name)) = 'misa otp verified'
  LIMIT 1
)
INSERT INTO public.crm_lead_tags (name, color, parent_tag_id)
SELECT v.name, v.color, parent.id
FROM parent,
(
  VALUES
    ('MISA OTP · WhatsApp', '#99F6E4'),
    ('MISA OTP · Website', '#C7D2FE'),
    ('MISA OTP · App', '#BBF7D0')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = lower(btrim(v.name))
);

-- Link any pre-created children to parent
UPDATE public.crm_lead_tags child
SET parent_tag_id = parent.id
FROM public.crm_lead_tags parent
WHERE lower(btrim(parent.name)) = 'misa otp verified'
  AND child.parent_tag_id IS NULL
  AND child.id <> parent.id
  AND (
    lower(btrim(child.name)) LIKE 'misa otp ·%'
    OR lower(btrim(child.name)) LIKE 'misa otp -%'
  );

-- Non-MISA booking OTP tags (Website form / App booking)
INSERT INTO public.crm_lead_tags (name, color)
SELECT v.name, v.color
FROM (
  VALUES
    ('Web OTP Verified', '#FDE68A'),
    ('Mob OTP Verified', '#A7F3D0')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = lower(btrim(v.name))
);

COMMENT ON TABLE public.crm_lead_tags IS
  'CRM tags; MISA OTP Verified is parent of WhatsApp/Website/App OTP channel tags';
