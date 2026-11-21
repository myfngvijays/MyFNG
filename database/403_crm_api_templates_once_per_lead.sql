-- API Templates: "Send only once per lead".
-- When on, a template sends a lead at most once (ever), even if the lead goes back and
-- moves into the trigger status again — e.g. the "Today send lead" Google Sheet row.
-- For Booking confirmed templates, a lead that the old code already put on the sheet
-- (coupon_meta.won_sheet_at) counts as already sent.
--
-- Run once in Supabase SQL editor (after 402).

ALTER TABLE public.crm_api_templates
  ADD COLUMN IF NOT EXISTS send_once_per_lead boolean NOT NULL DEFAULT false;
