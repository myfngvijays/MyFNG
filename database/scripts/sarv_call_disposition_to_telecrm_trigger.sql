-- =====================================================
-- Trigger: Auto-sync sarv_calls.disposition* into telecrm_api
-- Purpose:
--   When a sarv_calls row is INSERT/UPDATE'd with disposition data, find
--   matching telecrm_api rows (by recording_url) and update their disposition
--   fields. If those rows were already pushed to TeleCRM, also reset
--   api_response so the cron re-pushes them with the new disposition.
--
-- Why we need this:
--   Sarv fires multiple webhooks per call - the disposition often arrives
--   AFTER the initial call webhook. The initial telecrm_api row gets
--   inserted without disposition; later disposition updates only touch
--   sarv_calls. Without this trigger, telecrm_api would never see the
--   disposition unless we re-ran a backfill.
--
-- Safe to re-run.
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_sarv_disposition_to_telecrm()
RETURNS TRIGGER AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Only act when there's at least one disposition field set and a recording_url
  -- to match on. Recording URL is unique-per-call so it's a safe natural key.
  IF NEW.recording_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.disposition IS NULL
     AND NEW.disposition_category IS NULL
     AND NEW.disposition_note IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update matching telecrm_api rows. Only fill NULL fields (don't overwrite
  -- manually edited data). Reset api_response so the cron re-pushes if any
  -- field actually changed.
  UPDATE public.telecrm_api t
  SET
    disposition          = COALESCE(t.disposition, NEW.disposition),
    disposition_category = COALESCE(t.disposition_category, NEW.disposition_category),
    disposition_note     = COALESCE(t.disposition_note, NEW.disposition_note),
    api_response = CASE
      WHEN (t.disposition IS NULL AND NEW.disposition IS NOT NULL)
        OR (t.disposition_category IS NULL AND NEW.disposition_category IS NOT NULL)
        OR (t.disposition_note IS NULL AND NEW.disposition_note IS NOT NULL)
      THEN NULL
      ELSE t.api_response
    END,
    api_datetime = CASE
      WHEN (t.disposition IS NULL AND NEW.disposition IS NOT NULL)
        OR (t.disposition_category IS NULL AND NEW.disposition_category IS NOT NULL)
        OR (t.disposition_note IS NULL AND NEW.disposition_note IS NOT NULL)
      THEN NULL
      ELSE t.api_datetime
    END,
    updated_at = NOW()
  WHERE t.recording_url = NEW.recording_url
    AND (
      (t.disposition IS NULL AND NEW.disposition IS NOT NULL)
      OR (t.disposition_category IS NULL AND NEW.disposition_category IS NOT NULL)
      OR (t.disposition_note IS NULL AND NEW.disposition_note IS NOT NULL)
    );

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE NOTICE 'sync_sarv_disposition_to_telecrm: updated % telecrm_api row(s) for recording_url=%', rows_affected, NEW.recording_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sarv_disposition_sync_telecrm ON public.sarv_calls;

CREATE TRIGGER trg_sarv_disposition_sync_telecrm
AFTER INSERT OR UPDATE OF disposition, disposition_category, disposition_note, recording_url ON public.sarv_calls
FOR EACH ROW
EXECUTE FUNCTION public.sync_sarv_disposition_to_telecrm();

DO $$
BEGIN
  RAISE NOTICE '✅ sarv_calls → telecrm_api disposition sync trigger created';
END $$;
