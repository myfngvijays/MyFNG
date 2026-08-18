-- Soft-delete exact fake/test CRM leads that clog Reminders.
-- Do NOT match real customers like "Shubham Berde" / "Shubham Patil".
--
-- Targets:
--   todaynewlead  L-76095091
--   maahi         L-47208303
--   rahul shinde S L-52518940
--   shubham       L-07677899
--
-- Preview first, then run the DO block in Supabase SQL editor.

SELECT id, lead_number, customer_name, status, created_at, deleted_at
FROM public.service_leads
WHERE deleted_at IS NULL
  AND (
    id IN (
      'cd6c40ee-9cf9-4547-8e8f-9bc5d5c5e56e'::uuid,
      '18a55bac-fb4f-4014-b51b-c5c3180f0c81'::uuid,
      '3bf66f41-41c8-4969-8f2c-dffdfb36467a'::uuid,
      '960268db-3d27-4ae1-97a6-976c4e57b545'::uuid
    )
    OR lead_number IN ('L-76095091', 'L-47208303', 'L-52518940', 'L-07677899')
    OR lower(trim(customer_name)) IN (
      'todaynewlead',
      'maahi',
      'rahul shinde s',
      'shubham'
    )
  )
ORDER BY created_at DESC;

DO $$
DECLARE
  v_lead_ids UUID[] := ARRAY[
    'cd6c40ee-9cf9-4547-8e8f-9bc5d5c5e56e'::uuid,
    '18a55bac-fb4f-4014-b51b-c5c3180f0c81'::uuid,
    '3bf66f41-41c8-4969-8f2c-dffdfb36467a'::uuid,
    '960268db-3d27-4ae1-97a6-976c4e57b545'::uuid
  ];
  v_fu_cancelled INT;
  v_leads_soft INT;
BEGIN
  UPDATE public.telecaller_follow_ups
  SET
    status = 'CANCELLED',
    updated_at = NOW()
  WHERE lead_id = ANY (v_lead_ids)
    AND status = 'PENDING';

  GET DIAGNOSTICS v_fu_cancelled = ROW_COUNT;

  UPDATE public.service_leads
  SET deleted_at = NOW()
  WHERE id = ANY (v_lead_ids)
    AND deleted_at IS NULL
    AND lower(trim(customer_name)) IN (
      'todaynewlead',
      'maahi',
      'rahul shinde s',
      'shubham'
    );

  GET DIAGNOSTICS v_leads_soft = ROW_COUNT;

  RAISE NOTICE 'Soft-deleted leads: %, cancelled pending follow-ups: %',
    v_leads_soft, v_fu_cancelled;
END $$;
