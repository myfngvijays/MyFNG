-- Premium / Platinum periodic master checklists: store Replace for air + cabin filters.
-- Website still shows Clean only for PREMIUM SUV/MUVs and PREMIUM LUXURY.

UPDATE public.service_type_checklist_templates t
SET
  checklist_items = sub.next_items,
  updated_at = now()
FROM (
  SELECT
    t2.id,
    (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN regexp_replace(lower(coalesce(elem->>'name', '')), '\s+', ' ', 'g')
                 ~ '^(clean(ing)? air filter)$'
              THEN jsonb_set(elem, '{name}', '"Replace Air Filter"')
            WHEN regexp_replace(lower(coalesce(elem->>'name', '')), '\s+', ' ', 'g')
                 ~ '^(clean(ing)? cabin( ac)? filter)$'
              THEN jsonb_set(elem, '{name}', '"Replace Cabin AC Filter"')
            ELSE elem
          END
          ORDER BY ord
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(t2.checklist_items) WITH ORDINALITY AS e(elem, ord)
    ) AS next_items
  FROM public.service_type_checklist_templates t2
  JOIN public.service_types st ON st.id = t2.service_type_id
  WHERE (
      t2.points IN (50, 60)
      OR upper(st.name) LIKE '%PREMIUM%'
      OR upper(st.name) LIKE '%PLATINUM%'
    )
    AND upper(st.name) NOT LIKE '%BASIC%'
    AND upper(st.name) NOT LIKE '%GENERAL%'
) sub
WHERE t.id = sub.id;
