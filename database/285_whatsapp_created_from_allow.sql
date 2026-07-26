-- Allow WhatsApp / Meta inbound created_from values on service_leads
-- (some older DBs restricted created_from to WEB/MOBILE/API/IMPORT/TELECALLER)
-- Do NOT alter column type — view leads_with_details depends on created_from.

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'service_leads'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%created_from%'
  LOOP
    EXECUTE format('ALTER TABLE public.service_leads DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

COMMENT ON COLUMN public.service_leads.created_from IS
  'Source channel: WEB, MOBILE, MOBILE_APP, API, IMPORT, TELECALLER, TELECALLER_CRM, WHATSAPP, WHATSAPP_META, GMB, PARTNER';
