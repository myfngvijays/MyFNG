-- =====================================================
-- Migration: Auto-sync rsa_leads data into telecrm_api
-- Purpose: When an RSA complaint is registered or updated,
--          find telecrm_api rows with matching mobile number
--          and populate RSA lead fields + city/state from pincode.
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_rsa_lead_to_telecrm()
RETURNS TRIGGER AS $$
DECLARE
  phone10 TEXT;
  pin_city TEXT;
  pin_state TEXT;
BEGIN
  phone10 := RIGHT(regexp_replace(COALESCE(NEW.contact_number, ''), '\D', '', 'g'), 10);

  IF length(phone10) < 10 THEN
    RETURN NEW;
  END IF;

  IF NEW.pincode IS NOT NULL AND trim(NEW.pincode) != '' THEN
    SELECT district, state INTO pin_city, pin_state
    FROM public.pincode_city_state
    WHERE pincode = trim(NEW.pincode)
    LIMIT 1;
  END IF;

  UPDATE public.telecrm_api
  SET
    name                  = COALESCE(NEW.customer_name, name),
    pincode               = COALESCE(NEW.pincode, pincode),
    city                  = COALESCE(pin_city, city),
    state                 = COALESCE(pin_state, state),
    service_type          = COALESCE(NEW.service_type, service_type),
    vehicle_number        = COALESCE(NEW.vehicle_number, vehicle_number),
    vehicle_model         = COALESCE(NEW.vehicle_model, vehicle_model),
    customer_quoted_amount = COALESCE(NEW.customer_quoted_amount, customer_quoted_amount),
    location_link         = COALESCE(NEW.location_link, location_link),
    updated_at            = now()
  WHERE mobile = phone10;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rsa_lead_sync_telecrm ON public.rsa_leads;

CREATE TRIGGER trg_rsa_lead_sync_telecrm
AFTER INSERT OR UPDATE ON public.rsa_leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_rsa_lead_to_telecrm();

DO $$
BEGIN
  RAISE NOTICE '✅ rsa_leads → telecrm_api sync trigger created';
END $$;
