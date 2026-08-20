-- Parent/common lead tags (e.g. Meta Ads) + children (Meta Ads A/B/C).
-- Safe to re-run.

ALTER TABLE public.crm_lead_tags
  ADD COLUMN IF NOT EXISTS parent_tag_id uuid REFERENCES public.crm_lead_tags(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_lead_tags_parent
  ON public.crm_lead_tags (parent_tag_id)
  WHERE parent_tag_id IS NOT NULL;

COMMENT ON COLUMN public.crm_lead_tags.parent_tag_id IS
  'Optional common/parent tag — applying a child also applies the parent (TeleCRM Meta Ads pattern)';

-- Ensure common Meta Ads exists
INSERT INTO public.crm_lead_tags (name, color)
SELECT 'Meta Ads', '#DDD6FE'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t WHERE lower(btrim(t.name)) = 'meta ads'
);

-- Example children A / B / C under Meta Ads (admins can add more)
WITH parent AS (
  SELECT id FROM public.crm_lead_tags WHERE lower(btrim(name)) = 'meta ads' LIMIT 1
)
INSERT INTO public.crm_lead_tags (name, color, parent_tag_id)
SELECT v.name, v.color, parent.id
FROM parent,
(
  VALUES
    ('Meta Ads A', '#E9D5FF'),
    ('Meta Ads B', '#FBCFE8'),
    ('Meta Ads C', '#C7D2FE')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_lead_tags t WHERE lower(btrim(t.name)) = lower(btrim(v.name))
);

-- Link any existing "Meta Ads · X" style tags to Meta Ads parent when unmatched
UPDATE public.crm_lead_tags child
SET parent_tag_id = parent.id
FROM public.crm_lead_tags parent
WHERE lower(btrim(parent.name)) = 'meta ads'
  AND child.parent_tag_id IS NULL
  AND child.id <> parent.id
  AND (
    lower(btrim(child.name)) ~ '^meta ads[ ·\\-_]'
    OR lower(btrim(child.name)) LIKE 'meta ads %'
  );
