-- Ensure telecaller channel tags exist with the exact display names used in CRM UI.
-- Safe to re-run.

INSERT INTO public.crm_lead_tags (name, color)
SELECT v.name, v.color
FROM (
  VALUES
    ('Website', '#BFDBFE'),
    ('Google', '#FED7AA'),
    ('Reference', '#FDE68A'),
    ('WhatsApp', '#99F6E4'),
    ('Facebook', '#E9D5FF'),
    ('Instagram', '#FBCFE8'),
    ('Banner/Offline', '#FEF08A'),
    ('Other', '#F1F5F9')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crm_lead_tags t
  WHERE lower(btrim(t.name)) = lower(btrim(v.name))
);
