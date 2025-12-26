-- ============================================
-- Drop ANY legacy UNIQUE constraint/index on invoices(lead_id)
-- Needed for OS/CI/TI multi-document flow (multiple invoices per lead)
--
-- This is more robust than dropping a single known constraint name because
-- some installs create different names (e.g. invoices_lead_id_key) or a unique index.
-- ============================================

DO $$
DECLARE
  v_tbl regclass := 'public.invoices'::regclass;
  v_lead_attnum int;
  r record;
BEGIN
  SELECT a.attnum
    INTO v_lead_attnum
  FROM pg_attribute a
  WHERE a.attrelid = v_tbl
    AND a.attname = 'lead_id'
    AND NOT a.attisdropped;

  IF v_lead_attnum IS NULL THEN
    RAISE NOTICE 'invoices.lead_id column not found; skipping';
    RETURN;
  END IF;

  -- Drop UNIQUE constraints where the key is ONLY lead_id
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_tbl
      AND contype = 'u'
      AND conkey = ARRAY[v_lead_attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped UNIQUE constraint: %', r.conname;
  END LOOP;

  -- Drop UNIQUE indexes where the indexed columns are ONLY lead_id
  FOR r IN
    SELECT i.relname AS indexname
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE x.indrelid = v_tbl
      AND x.indisunique
      AND x.indkey::int[] = ARRAY[v_lead_attnum]
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
    RAISE NOTICE 'Dropped UNIQUE index: %', r.indexname;
  END LOOP;
END $$;


