-- Case-insensitive unique names for CRM lead tags (prevents test / TEST duplicates).
-- Cleans existing case-duplicates first (keeps oldest by created_at), then adds unique index.
-- Safe to re-run.

-- Remap lead_tag_map from duplicate tags → canonical (oldest) tag, then delete dup rows
WITH ranked AS (
  SELECT
    id,
    lower(btrim(name)) AS name_key,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.crm_lead_tags
),
dups AS (
  SELECT id AS dup_id, name_key
  FROM ranked
  WHERE rn > 1
),
keepers AS (
  SELECT id AS keep_id, name_key
  FROM ranked
  WHERE rn = 1
),
pairs AS (
  SELECT d.dup_id, k.keep_id
  FROM dups d
  JOIN keepers k ON k.name_key = d.name_key
)
UPDATE public.crm_lead_tag_map m
SET tag_id = p.keep_id
FROM pairs p
WHERE m.tag_id = p.dup_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_tag_map x
    WHERE x.lead_id = m.lead_id
      AND x.tag_id = p.keep_id
  );

DELETE FROM public.crm_lead_tag_map m
USING (
  WITH ranked AS (
    SELECT
      id,
      lower(btrim(name)) AS name_key,
      ROW_NUMBER() OVER (
        PARTITION BY lower(btrim(name))
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.crm_lead_tags
  )
  SELECT id AS dup_id
  FROM ranked
  WHERE rn > 1
) d
WHERE m.tag_id = d.dup_id;

DELETE FROM public.crm_lead_tags t
USING (
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(btrim(name))
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.crm_lead_tags
  )
  SELECT id AS dup_id
  FROM ranked
  WHERE rn > 1
) d
WHERE t.id = d.dup_id;

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_tags_name_lower_uidx
  ON public.crm_lead_tags (lower(btrim(name)));
