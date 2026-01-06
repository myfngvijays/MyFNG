-- =====================================================
-- 107: RPC - Apply Additional Jobs (details + labour by fuel) to all workshops in a zone
-- Purpose:
--  - Fast bulk apply for large zones (50 -> 500 workshops)
--  - One DB-side transaction using set-based SQL (no per-workshop roundtrips)
-- =====================================================

BEGIN;

-- Normalize string keys for matching by name (case-insensitive, whitespace-normalized)
CREATE OR REPLACE FUNCTION public.normalize_text_key(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(btrim(coalesce(t, ''))), '\s+', ' ', 'g');
$$;

-- Safe numeric cast (returns NULL on invalid/blank input)
CREATE OR REPLACE FUNCTION public.try_numeric(t text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  IF btrim(t) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(t)::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- RPC: Apply items to zone
-- p_items jsonb array elements shape (strings allowed for labour fields):
--  {
--    source_additional_job_id, name, description, category, hsn_sac_code, unit,
--    oem_price, oes_price, tax_rate, is_active,
--    default_labour, petrol_labour, diesel_labour, cng_labour
--  }
CREATE OR REPLACE FUNCTION public.apply_ajm_labour_zone_bulk(
  p_zone_id uuid,
  p_car_class text,
  p_mode text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
  v_is_super boolean;
  v_mode text := upper(coalesce(p_mode, 'OVERWRITE'));
  v_now timestamptz := now();
  v_inserted int := 0;
  v_updated int := 0;
  v_rate_rows int := 0;
BEGIN
  IF p_zone_id IS NULL THEN
    RAISE EXCEPTION 'zone_id is required';
  END IF;
  IF p_car_class IS NULL OR btrim(p_car_class) = '' THEN
    RAISE EXCEPTION 'car_class is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a jsonb array';
  END IF;

  v_email := coalesce(auth.jwt() ->> 'email', '');
  v_phone := coalesce(auth.jwt() ->> 'phone', '');

  SELECT EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE r.role_code = 'SUPER_ADMIN'
      AND (
        (v_email <> '' AND lower(ul.email) = lower(v_email))
        OR (v_phone <> '' AND ul.phone = v_phone)
        OR (ul.id = auth.uid())
      )
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  CREATE TEMP TABLE tmp_ajm_items (
    source_id uuid,
    name text,
    name_key text,
    description text,
    category text,
    hsn_sac_code text,
    unit text,
    oem_price numeric,
    oes_price numeric,
    tax_rate numeric,
    is_active boolean,
    default_labour numeric,
    petrol_labour numeric,
    diesel_labour numeric,
    cng_labour numeric
  ) ON COMMIT DROP;

  INSERT INTO tmp_ajm_items (
    source_id, name, name_key, description, category, hsn_sac_code, unit,
    oem_price, oes_price, tax_rate, is_active,
    default_labour, petrol_labour, diesel_labour, cng_labour
  )
  SELECT
    (x.source_additional_job_id)::uuid,
    btrim(coalesce(x.name, '')),
    public.normalize_text_key(x.name),
    NULLIF(btrim(coalesce(x.description, '')), ''),
    NULLIF(btrim(coalesce(x.category, '')), ''),
    NULLIF(btrim(coalesce(x.hsn_sac_code, '')), ''),
    COALESCE(NULLIF(btrim(coalesce(x.unit, '')), ''), 'job'),
    COALESCE(public.try_numeric(x.oem_price), 0),
    COALESCE(public.try_numeric(x.oes_price), 0),
    COALESCE(public.try_numeric(x.tax_rate), 18),
    CASE
      WHEN x.is_active IS NULL OR btrim(x.is_active) = '' THEN true
      WHEN lower(btrim(x.is_active)) IN ('true','1','yes') THEN true
      ELSE false
    END,
    public.try_numeric(x.default_labour),
    public.try_numeric(x.petrol_labour),
    public.try_numeric(x.diesel_labour),
    public.try_numeric(x.cng_labour)
  FROM jsonb_to_recordset(p_items) AS x(
    source_additional_job_id text,
    name text,
    description text,
    category text,
    hsn_sac_code text,
    unit text,
    oem_price text,
    oes_price text,
    tax_rate text,
    is_active text,
    default_labour text,
    petrol_labour text,
    diesel_labour text,
    cng_labour text
  )
  WHERE btrim(coalesce(x.name, '')) <> '';

  -- Workspaces in zone
  WITH ws AS (
    SELECT id AS workshop_id
    FROM public.workshops
    WHERE zone_id = p_zone_id
  ),
  existing AS (
    SELECT DISTINCT ON (ajm.workshop_id, public.normalize_text_key(ajm.name))
      ajm.workshop_id,
      ajm.id,
      public.normalize_text_key(ajm.name) AS name_key
    FROM public.additional_jobs_master ajm
    JOIN ws ON ws.workshop_id = ajm.workshop_id
    WHERE ajm.deleted_at IS NULL
    ORDER BY ajm.workshop_id, public.normalize_text_key(ajm.name), ajm.created_at DESC
  ),
  targets AS (
    SELECT
      ws.workshop_id,
      it.source_id,
      it.name,
      it.name_key,
      it.description,
      it.category,
      it.hsn_sac_code,
      it.unit,
      it.oem_price,
      it.oes_price,
      it.tax_rate,
      it.is_active,
      COALESCE(it.petrol_labour, it.default_labour, 0) AS computed_default_labour,
      it.petrol_labour,
      it.diesel_labour,
      it.cng_labour,
      ex.id AS existing_id
    FROM ws
    CROSS JOIN tmp_ajm_items it
    LEFT JOIN existing ex
      ON ex.workshop_id = ws.workshop_id
     AND ex.name_key = it.name_key
  )
  INSERT INTO public.additional_jobs_master (
    workshop_id, name, description, category, hsn_sac_code, unit,
    oem_price, oes_price, tax_rate, labour_price, is_active,
    created_by, created_at, updated_at
  )
  SELECT
    t.workshop_id,
    t.name,
    t.description,
    t.category,
    t.hsn_sac_code,
    t.unit,
    t.oem_price,
    t.oes_price,
    t.tax_rate,
    t.computed_default_labour,
    t.is_active,
    NULL::uuid,
    v_now,
    v_now
  FROM targets t
  WHERE t.existing_id IS NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_mode = 'OVERWRITE' THEN
    WITH ws AS (
      SELECT id AS workshop_id
      FROM public.workshops
      WHERE zone_id = p_zone_id
    ),
    existing AS (
      SELECT ajm.id, ajm.workshop_id, public.normalize_text_key(ajm.name) AS name_key
      FROM public.additional_jobs_master ajm
      JOIN ws ON ws.workshop_id = ajm.workshop_id
      WHERE ajm.deleted_at IS NULL
    ),
    targets AS (
      SELECT
        ex.id AS target_id,
        it.name,
        it.description,
        it.category,
        it.hsn_sac_code,
        it.unit,
        it.oem_price,
        it.oes_price,
        it.tax_rate,
        it.is_active,
        COALESCE(it.petrol_labour, it.default_labour, 0) AS computed_default_labour
      FROM existing ex
      JOIN tmp_ajm_items it
        ON it.name_key = ex.name_key
    )
    UPDATE public.additional_jobs_master ajm
    SET
      name = t.name,
      description = t.description,
      category = t.category,
      hsn_sac_code = t.hsn_sac_code,
      unit = t.unit,
      oem_price = t.oem_price,
      oes_price = t.oes_price,
      tax_rate = t.tax_rate,
      labour_price = t.computed_default_labour,
      is_active = t.is_active,
      updated_at = v_now
    FROM targets t
    WHERE ajm.id = t.target_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  -- Apply labour rates (for selected car class only)
  -- Recompute target job IDs after inserts
  IF v_mode = 'FILL_MISSING' THEN
    INSERT INTO public.additional_jobs_master_labour_rates (
      additional_job_id, fuel_type, car_class, labour_price, created_by, created_at, updated_at
    )
    WITH ws AS (
      SELECT id AS workshop_id
      FROM public.workshops
      WHERE zone_id = p_zone_id
    ),
    target_jobs AS (
      SELECT
        ajm.id AS additional_job_id,
        public.normalize_text_key(ajm.name) AS name_key
      FROM public.additional_jobs_master ajm
      JOIN ws ON ws.workshop_id = ajm.workshop_id
      WHERE ajm.deleted_at IS NULL
    ),
    rows_to_apply AS (
      SELECT
        tj.additional_job_id,
        p_car_class AS car_class,
        v.fuel_type,
        v.labour_price
      FROM tmp_ajm_items it
      JOIN target_jobs tj
        ON tj.name_key = it.name_key
      CROSS JOIN LATERAL (
        VALUES
          ('PETROL'::text, it.petrol_labour),
          ('DIESEL'::text, it.diesel_labour),
          ('CNG'::text, it.cng_labour)
      ) AS v(fuel_type, labour_price)
      WHERE v.labour_price IS NOT NULL
    )
    SELECT
      r.additional_job_id,
      r.fuel_type,
      r.car_class,
      r.labour_price,
      NULL::uuid,
      v_now,
      v_now
    FROM rows_to_apply r
    ON CONFLICT (additional_job_id, fuel_type, car_class) DO NOTHING;
  ELSE
    INSERT INTO public.additional_jobs_master_labour_rates (
      additional_job_id, fuel_type, car_class, labour_price, created_by, created_at, updated_at
    )
    WITH ws AS (
      SELECT id AS workshop_id
      FROM public.workshops
      WHERE zone_id = p_zone_id
    ),
    target_jobs AS (
      SELECT
        ajm.id AS additional_job_id,
        public.normalize_text_key(ajm.name) AS name_key
      FROM public.additional_jobs_master ajm
      JOIN ws ON ws.workshop_id = ajm.workshop_id
      WHERE ajm.deleted_at IS NULL
    ),
    rows_to_apply AS (
      SELECT
        tj.additional_job_id,
        p_car_class AS car_class,
        v.fuel_type,
        v.labour_price
      FROM tmp_ajm_items it
      JOIN target_jobs tj
        ON tj.name_key = it.name_key
      CROSS JOIN LATERAL (
        VALUES
          ('PETROL'::text, it.petrol_labour),
          ('DIESEL'::text, it.diesel_labour),
          ('CNG'::text, it.cng_labour)
      ) AS v(fuel_type, labour_price)
      WHERE v.labour_price IS NOT NULL
    )
    SELECT
      r.additional_job_id,
      r.fuel_type,
      r.car_class,
      r.labour_price,
      NULL::uuid,
      v_now,
      v_now
    FROM rows_to_apply r
    ON CONFLICT (additional_job_id, fuel_type, car_class) DO UPDATE
      SET labour_price = EXCLUDED.labour_price,
          updated_at = v_now;
  END IF;

  GET DIAGNOSTICS v_rate_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'zone_id', p_zone_id,
    'car_class', p_car_class,
    'mode', v_mode,
    'inserted_job_rows', v_inserted,
    'updated_job_rows', v_updated,
    'labour_rate_rows', v_rate_rows
  );
END;
$$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ RPC apply_ajm_labour_zone_bulk created/updated';
END $$;


