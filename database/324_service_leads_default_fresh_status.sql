-- Default CRM disposition for new service_leads = Fresh.
-- BEFORE INSERT: if last_call_result empty and lead not already closed, stamp FRESH.
-- Also backfills existing open NEW leads without a disposition.
-- Safe to re-run.
-- Note: status is enum lead_status — always cast to text before COALESCE with ''.

CREATE OR REPLACE FUNCTION public.service_leads_default_fresh_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  meta jsonb;
  result text;
  st text;
BEGIN
  meta := COALESCE(NEW.coupon_meta, '{}'::jsonb);
  result := upper(btrim(COALESCE(meta->>'last_call_result', '')));
  IF result <> '' THEN
    RETURN NEW;
  END IF;

  st := upper(btrim(COALESCE(NEW.status::text, 'NEW')));
  -- Skip closed / terminal pipeline (already booked done / lost / cancelled)
  IF st IN ('REJECTED', 'COMPLETED', 'CANCELLED', 'CLOSED') THEN
    RETURN NEW;
  END IF;

  NEW.coupon_meta := meta || jsonb_build_object(
    'last_call_result', 'FRESH',
    'last_call_label', 'Fresh'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_leads_default_fresh ON public.service_leads;
CREATE TRIGGER trg_service_leads_default_fresh
  BEFORE INSERT ON public.service_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.service_leads_default_fresh_status();

-- Backfill: open NEW leads with no disposition → Fresh
UPDATE public.service_leads
SET
  coupon_meta =
    COALESCE(coupon_meta, '{}'::jsonb)
    || jsonb_build_object('last_call_result', 'FRESH', 'last_call_label', 'Fresh'),
  updated_at = now()
WHERE status::text = 'NEW'
  AND COALESCE(is_incomplete, false) = false
  AND (
    coupon_meta IS NULL
    OR NULLIF(btrim(COALESCE(coupon_meta->>'last_call_result', '')), '') IS NULL
  );

COMMENT ON FUNCTION public.service_leads_default_fresh_status() IS
  'Auto-assign CRM disposition Fresh on new service_leads when no last_call_result set';
