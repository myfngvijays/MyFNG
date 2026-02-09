-- Migration: company_mechanic_rsa.service_areas from text[] to jsonb (or ensure jsonb)
-- So we can store area, state, pincode per service area and show them in Edit form.

DO $$
DECLARE
  col_type text;
  is_jsonb boolean := false;
BEGIN
  -- Check current type of service_areas
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'company_mechanic_rsa' AND column_name = 'service_areas';

  IF col_type = 'jsonb' THEN
    is_jsonb := true;
  END IF;

  IF NOT is_jsonb THEN
    -- Step 1: Add new jsonb column (only when current is text[])
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'company_mechanic_rsa' AND column_name = 'service_areas_jsonb'
    ) THEN
      ALTER TABLE public.company_mechanic_rsa ADD COLUMN service_areas_jsonb jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- Step 2: Migrate text[] to jsonb (only for text[] column)
    UPDATE public.company_mechanic_rsa
    SET service_areas_jsonb = (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('pincode', p, 'area', null, 'state', null)),
        '[]'::jsonb
      )
      FROM unnest(service_areas) AS p
    )
    WHERE service_areas IS NOT NULL AND array_length(service_areas, 1) > 0;

    UPDATE public.company_mechanic_rsa
    SET service_areas_jsonb = '[]'::jsonb
    WHERE service_areas_jsonb IS NULL;

    -- Step 3: Drop old column and rename
    ALTER TABLE public.company_mechanic_rsa DROP COLUMN IF EXISTS service_areas;
    ALTER TABLE public.company_mechanic_rsa RENAME COLUMN service_areas_jsonb TO service_areas;
  ELSE
    -- Already jsonb: if we have service_areas_jsonb from a partial run, clean up
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'company_mechanic_rsa' AND column_name = 'service_areas_jsonb'
    ) THEN
      ALTER TABLE public.company_mechanic_rsa DROP COLUMN service_areas_jsonb;
    END IF;
    -- Optionally normalize existing jsonb: if elements are plain strings, convert to { pincode, area, state }
    UPDATE public.company_mechanic_rsa
    SET service_areas = (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('pincode', elem #>> '{}', 'area', null, 'state', null)
          WHEN elem ? 'pincode' THEN elem
          ELSE jsonb_build_object('pincode', elem->>'pincode', 'area', elem->'area', 'state', elem->'state')
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(service_areas, '[]'::jsonb)) AS elem
    )
    WHERE service_areas IS NOT NULL AND jsonb_array_length(service_areas) > 0
      AND jsonb_typeof((SELECT elem FROM jsonb_array_elements(service_areas) AS elem LIMIT 1)) = 'string';
  END IF;
END $$;

-- Step 4: Drop existing function (return type changes: service_areas text[] -> jsonb)
DROP FUNCTION IF EXISTS rsa_manager_search_mechanics(text, text, text);

-- Step 5: Create RPC with jsonb return for service_areas
CREATE OR REPLACE FUNCTION rsa_manager_search_mechanics(
  p_pincode text DEFAULT NULL,
  p_service_tag text DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  mechanic_code text,
  mechanic_name text,
  number text,
  alternate_number1 text,
  alternate_number2 text,
  service_tag text,
  service_tag2 text,
  service_tag3 text,
  timing text,
  active boolean,
  service_areas jsonb,
  is_available boolean,
  rating numeric,
  total_jobs_completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.mechanic_code,
    m.mechanic_name,
    m.number,
    m.alternate_number1,
    m.alternate_number2,
    m.service_tag,
    m.service_tag2,
    m.service_tag3,
    m.timing,
    m.active,
    COALESCE(m.service_areas, '[]'::jsonb),
    m.is_available,
    m.rating,
    m.total_jobs_completed
  FROM public.company_mechanic_rsa m
  WHERE m.active = true
    AND (
      p_pincode IS NULL
      OR jsonb_array_length(COALESCE(m.service_areas, '[]'::jsonb)) = 0
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(m.service_areas, '[]'::jsonb)) AS elem
        WHERE elem->>'pincode' = p_pincode
      )
    )
    AND (
      p_service_tag IS NULL
      OR m.service_tag = p_service_tag
      OR m.service_tag2 = p_service_tag
      OR m.service_tag3 = p_service_tag
    )
    AND (
      p_search_term IS NULL
      OR p_search_term = ''
      OR m.mechanic_name ILIKE '%' || p_search_term || '%'
      OR m.mechanic_code ILIKE '%' || p_search_term || '%'
      OR m.number LIKE '%' || p_search_term || '%'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION rsa_manager_search_mechanics TO authenticated;
