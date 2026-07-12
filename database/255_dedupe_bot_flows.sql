-- Remove duplicate bot flows with the same name (keep best candidate per name)
-- Safe to run after accidental double-seed (SQL 254 + Install Preset Flows button)

WITH ranked AS (
  SELECT
    f.id,
    f.name,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(f.name))
      ORDER BY
        CASE
          WHEN (s.setting_value::jsonb ->> 'active_flow_id') = f.id::text THEN 0
          ELSE 1
        END,
        CASE WHEN upper(f.status) = 'PUBLISHED' THEN 0 ELSE 1 END,
        f.updated_at DESC NULLS LAST,
        f.created_at DESC NULLS LAST
    ) AS rn
  FROM public.bot_flows f
  LEFT JOIN public.system_settings s
    ON s.setting_key = 'whatsapp_ai_brain_config'
)
DELETE FROM public.bot_flows f
USING ranked r
WHERE f.id = r.id
  AND r.rn > 1;
