-- =====================================================
-- Trigger: Auto-push public.dialer_leads -> TeleCRM autoupdatelead
-- =====================================================
-- Purpose:
--   Whenever the local dialer software inserts (or updates) a row in
--   public.dialer_leads, fire-and-forget POST the data to the TeleCRM
--   autoupdatelead endpoint using the same payload shape that the
--   myfng.in/crm web form uses. Includes the extra columns that only the
--   dialer captures: recording_url + intrested_customer_date.
--
-- How it works:
--   - Uses the `pg_net` extension (available by default on Supabase) to do
--     the HTTP call asynchronously from inside Postgres so the INSERT into
--     dialer_leads never blocks on TeleCRM latency.
--   - Logs every queued push into public.dialer_telecrm_push_log for easy
--     monitoring; pg_net's response (status code + body) lands in
--     net._http_response and is back-filled via request_id.
--
-- Idempotency:
--   - The TeleCRM endpoint is `autoupdatelead`, which upserts on `Phone` -
--     so re-pushing the same lead is safe.
--   - This script is safe to re-run; the function + trigger are dropped and
--     recreated on every apply.
--
-- Hard-coded constants (kept identical to /crm web form):
--     LEADTAG     = 'DELHILEAD'
--     LeadSource  = 'delhi_service'
--     Source      = 'delhi_service'
--     LeadStatus  = 'NEW'
--     CreatedFrom = 'CRM'
--     actions[0]  = { type: 'SYSTEM_NOTE', text: 'Lead Source: DELHILEAD' }
--
-- Safe to re-run.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- 1. Log table (so we can audit every push attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dialer_telecrm_push_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialer_lead_id  uuid REFERENCES public.dialer_leads(id) ON DELETE CASCADE,
  phone_no        text,
  request_id      bigint,
  payload         jsonb,
  trigger_op      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dialer_telecrm_push_log_dialer_lead_id
  ON public.dialer_telecrm_push_log (dialer_lead_id);
CREATE INDEX IF NOT EXISTS idx_dialer_telecrm_push_log_request_id
  ON public.dialer_telecrm_push_log (request_id);
CREATE INDEX IF NOT EXISTS idx_dialer_telecrm_push_log_created_at
  ON public.dialer_telecrm_push_log (created_at DESC);

ALTER TABLE public.dialer_telecrm_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on dialer_telecrm_push_log"
  ON public.dialer_telecrm_push_log;
CREATE POLICY "Service role full access on dialer_telecrm_push_log"
  ON public.dialer_telecrm_push_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read dialer_telecrm_push_log"
  ON public.dialer_telecrm_push_log;
CREATE POLICY "Admins can read dialer_telecrm_push_log"
  ON public.dialer_telecrm_push_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE (ul.id = auth.uid()
             OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
             OR ul.phone = (auth.jwt() ->> 'phone'))
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_dialer_lead_to_telecrm()
RETURNS TRIGGER AS $$
DECLARE
  -- TeleCRM endpoint / auth (kept identical to apps/web/src/app/api/crm/enquiries/route.ts).
  telecrm_url   constant text := 'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
  telecrm_token constant text := '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

  phone_digits text;
  phone10      text;
  fields       jsonb;
  payload      jsonb;
  req_id       bigint;
BEGIN
  -- ----- 1. Disposition filter: only push Interested leads -----
  IF lower(coalesce(trim(NEW.disposition), '')) NOT IN (
    'intrested hot', 'intrested warm', 'intrested cold'
  ) THEN
    RETURN NEW;
  END IF;

  -- ----- 2. Phone validation -----
  phone_digits := regexp_replace(coalesce(NEW.phone_no, ''), '\D', '', 'g');
  IF phone_digits IS NULL OR length(phone_digits) < 10 THEN
    RAISE NOTICE '[dialer_leads -> TeleCRM] Skipping row % - invalid phone "%"',
                 NEW.id, NEW.phone_no;
    RETURN NEW;
  END IF;
  phone10 := right(phone_digits, 10);

  -- ----- 2. Required hard-coded fields (identical to the /crm web form) -----
  fields := jsonb_build_object(
    'Name',        coalesce(nullif(trim(NEW.name), ''), 'CRM Lead'),
    'Phone',       '+91' || phone10,
    'LEADTAG',     'DELHILEAD',
    'LeadSource',  'delhi_service',
    'Source',      'delhi_service',
    'LeadStatus',  'NEW',
    'CreatedFrom', 'CRM',
    'CreatedAt',   to_char(
                     coalesce(NEW.created_at, now()) AT TIME ZONE 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                   )
  );

  -- ----- 3. Optional fields (only added when non-empty) -----
  IF nullif(trim(NEW.car_number), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('CARNO', NEW.car_number);
  END IF;

  IF nullif(trim(NEW.make), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('VehicleMake', NEW.make);
  END IF;

  IF nullif(trim(NEW.model), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('VehicleModel', NEW.model);
  END IF;

  IF nullif(trim(NEW.address), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('Address', NEW.address);
  END IF;

  IF nullif(trim(NEW.regdate), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('RegistrationDate', NEW.regdate);
  END IF;

  IF nullif(trim(NEW.disposition), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object(
      'Disposition',
      regexp_replace(NEW.disposition, '[\u2013\u2014]', '-', 'g')
    );
  END IF;

  IF nullif(trim(NEW.dialer_id), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('dailerid_1', NEW.dialer_id);
  END IF;

  IF nullif(trim(NEW.remark), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('Remark', NEW.remark);
  END IF;

  -- ----- 4. Dialer-only extras (not present on /crm form) -----
  IF nullif(trim(NEW.recording_url), '') IS NOT NULL THEN
    fields := fields || jsonb_build_object('recording_url', NEW.recording_url);
  END IF;

  IF NEW.intrested_customer_date IS NOT NULL THEN
    fields := fields || jsonb_build_object(
      'InterestedDate',
      to_char(NEW.intrested_customer_date, 'YYYY-MM-DD')
    );
  END IF;

  -- ----- 5. Build full payload (fields + actions) -----
  payload := jsonb_build_object(
    'fields', fields,
    'actions', jsonb_build_array(
      jsonb_build_object(
        'type', 'SYSTEM_NOTE',
        'text', 'Lead Source: DELHILEAD'
      )
    )
  );

  -- ----- 6. Fire off async via pg_net -----
  -- net.http_post returns a request_id that we log; the actual response lands
  -- in net._http_response so we can correlate later.
  BEGIN
    SELECT net.http_post(
      url     := telecrm_url,
      body    := payload,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || telecrm_token
      ),
      timeout_milliseconds := 15000
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[dialer_leads -> TeleCRM] pg_net call threw for row %: % - %',
                  NEW.id, SQLSTATE, SQLERRM;
    req_id := NULL;
  END;

  -- ----- 7. Audit log -----
  BEGIN
    INSERT INTO public.dialer_telecrm_push_log
      (dialer_lead_id, phone_no, request_id, payload, trigger_op)
    VALUES
      (NEW.id, phone10, req_id, payload, TG_OP);
  EXCEPTION WHEN OTHERS THEN
    -- Logging must never break the trigger; just emit a warning.
    RAISE WARNING '[dialer_leads -> TeleCRM] push log insert failed for row %: % - %',
                  NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Final safety net: trigger MUST NOT block the underlying INSERT.
  RAISE WARNING '[dialer_leads -> TeleCRM] unexpected failure for row %: % - %',
                NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Trigger binding
-- ---------------------------------------------------------------------------
-- Fire on INSERT (every fresh dialer disposition) and on UPDATE only when
-- a meaningful field changes. recording_url is excluded from UPDATE columns
-- because it is now set at INSERT time itself (no separate UPDATE needed).
DROP TRIGGER IF EXISTS trg_dialer_leads_push_telecrm ON public.dialer_leads;

CREATE TRIGGER trg_dialer_leads_push_telecrm
AFTER INSERT OR UPDATE OF
  phone_no, name, address, regdate, car_number, make, model,
  disposition, remark, dialer_id, intrested_customer_date
ON public.dialer_leads
FOR EACH ROW
EXECUTE FUNCTION public.push_dialer_lead_to_telecrm();

-- ---------------------------------------------------------------------------
-- 4. Done
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '[OK] dialer_leads -> TeleCRM autoupdatelead trigger installed.';
  RAISE NOTICE '     - Function: public.push_dialer_lead_to_telecrm()';
  RAISE NOTICE '     - Trigger : trg_dialer_leads_push_telecrm';
  RAISE NOTICE '     - Audit   : public.dialer_telecrm_push_log';
  RAISE NOTICE '     - pg_net response: SELECT * FROM net._http_response ORDER BY created DESC LIMIT 20;';
END $$;
