-- =====================================================
-- ONE-TIME BACKFILL SCRIPT (safe to re-run)
-- Purpose:
--   1) Backfill missing details in public.telecrm_api rows by joining with the
--      latest matching public.rsa_leads row (matched on last-10-digits of mobile).
--      Same enrichment logic as the existing trigger
--      `trg_rsa_lead_sync_telecrm` (database/208_*.sql).
--   2) For rows that get fresh data AND were already pushed to TeleCRM
--      (api_response IS NOT NULL), reset api_response/api_datetime so the
--      12-hour backfill cron picks them up again and re-pushes the enriched
--      payload to TeleCRM.
--   3) Set updated_at to the past so the cron's `updated_at < (now - 12h)`
--      filter immediately matches these rows on its next run.
--
-- Usage:
--   - Open Supabase SQL Editor, paste this entire file, RUN.
--   - Then trigger the cron once manually:
--       curl -s -H 'Authorization: Bearer <CRON_SECRET>' \
--         http://localhost:3000/api/cron/telecrm-push
--     (The cron will pick up the reset rows in batches of 50.)
--
-- Idempotent: running this multiple times is safe — it only updates rows that
-- still have NULL fields and only resets api_response on rows that actually got
-- new data this run.
-- =====================================================

BEGIN;

-- For each telecrm_api row, find the most recent matching rsa_lead by mobile.
-- Then COALESCE fill missing fields. Track which rows were modified so we can
-- selectively reset api_response only for those.
WITH latest_rsa AS (
  SELECT
    t.id AS telecrm_id,
    t.mobile,
    t.api_response,
    rl.customer_name,
    rl.pincode AS rl_pincode,
    rl.service_type AS rl_service_type,
    rl.vehicle_number AS rl_vehicle_number,
    rl.vehicle_model AS rl_vehicle_model,
    rl.customer_quoted_amount AS rl_customer_quoted_amount,
    rl.location_link AS rl_location_link,
    pcs.district AS pin_city,
    pcs.state AS pin_state,
    ROW_NUMBER() OVER (
      PARTITION BY t.id
      ORDER BY rl.lead_registered_at DESC NULLS LAST, rl.requested_at DESC NULLS LAST
    ) AS rn
  FROM public.telecrm_api t
  JOIN public.rsa_leads rl
    ON RIGHT(regexp_replace(COALESCE(rl.contact_number, ''), '\D', '', 'g'), 10) = t.mobile
  LEFT JOIN public.pincode_city_state pcs
    ON pcs.pincode = trim(rl.pincode)
  WHERE t.mobile IS NOT NULL
    AND length(t.mobile) = 10
),
enrichment AS (
  SELECT * FROM latest_rsa WHERE rn = 1
),
to_update AS (
  SELECT
    e.telecrm_id,
    e.api_response,
    e.customer_name,
    e.rl_pincode,
    e.rl_service_type,
    e.rl_vehicle_number,
    e.rl_vehicle_model,
    e.rl_customer_quoted_amount,
    e.rl_location_link,
    e.pin_city,
    e.pin_state,
    -- Will any column actually change?
    (
      (t.name IS NULL AND e.customer_name IS NOT NULL) OR
      (t.pincode IS NULL AND e.rl_pincode IS NOT NULL) OR
      (t.city IS NULL AND e.pin_city IS NOT NULL) OR
      (t.state IS NULL AND e.pin_state IS NOT NULL) OR
      (t.service_type IS NULL AND e.rl_service_type IS NOT NULL) OR
      (t.vehicle_number IS NULL AND e.rl_vehicle_number IS NOT NULL) OR
      (t.vehicle_model IS NULL AND e.rl_vehicle_model IS NOT NULL) OR
      (t.customer_quoted_amount IS NULL AND e.rl_customer_quoted_amount IS NOT NULL) OR
      (t.location_link IS NULL AND e.rl_location_link IS NOT NULL)
    ) AS will_change
  FROM enrichment e
  JOIN public.telecrm_api t ON t.id = e.telecrm_id
)
UPDATE public.telecrm_api t
SET
  name                   = COALESCE(t.name, u.customer_name),
  pincode                = COALESCE(t.pincode, u.rl_pincode),
  city                   = COALESCE(t.city, u.pin_city),
  state                  = COALESCE(t.state, u.pin_state),
  service_type           = COALESCE(t.service_type, u.rl_service_type),
  vehicle_number         = COALESCE(t.vehicle_number, u.rl_vehicle_number),
  vehicle_model          = COALESCE(t.vehicle_model, u.rl_vehicle_model),
  customer_quoted_amount = COALESCE(t.customer_quoted_amount, u.rl_customer_quoted_amount),
  location_link          = COALESCE(t.location_link, u.rl_location_link),
  -- If row changed AND was already pushed, reset api_response so cron re-pushes.
  -- If row didn't change, leave api_response alone.
  api_response  = CASE WHEN u.will_change AND u.api_response IS NOT NULL THEN NULL ELSE t.api_response END,
  api_datetime  = CASE WHEN u.will_change AND u.api_response IS NOT NULL THEN NULL ELSE t.api_datetime END,
  -- Push updated_at into the past so the 12hr cron filter matches immediately
  -- on its next run (only for rows that actually changed).
  updated_at    = CASE WHEN u.will_change THEN NOW() - INTERVAL '13 hours' ELSE t.updated_at END
FROM to_update u
WHERE t.id = u.telecrm_id;

-- =====================================================
-- Also force-eligible: rows that were never pushed (api_response IS NULL)
-- but their updated_at is still within the 12-hour window. Backdate them
-- so the cron picks them up on its next run instead of waiting the full 12hr.
-- =====================================================
UPDATE public.telecrm_api
SET updated_at = NOW() - INTERVAL '13 hours'
WHERE api_response IS NULL
  AND updated_at >= NOW() - INTERVAL '12 hours';

COMMIT;

-- =====================================================
-- Inspect what's now eligible for the next cron run
-- =====================================================
SELECT
  COUNT(*) FILTER (WHERE api_response IS NULL)                                AS pending_total,
  COUNT(*) FILTER (WHERE api_response IS NULL AND updated_at < NOW() - INTERVAL '12 hours') AS pending_eligible_now,
  COUNT(*) FILTER (WHERE api_response IS NOT NULL)                            AS already_pushed,
  COUNT(*)                                                                    AS total_rows
FROM public.telecrm_api;
