-- Fix type mismatch errors in RSA Manager RPCs
-- Error: Returned type character varying does not match expected type text

DROP FUNCTION IF EXISTS rsa_manager_get_all_leads(uuid, text, boolean);
DROP FUNCTION IF EXISTS rsa_manager_get_registered_leads(uuid, integer, integer);
DROP FUNCTION IF EXISTS rsa_manager_get_lead_detail(uuid);

-- 1. Get All RSA Leads
CREATE OR REPLACE FUNCTION rsa_manager_get_all_leads(
  p_manager_id uuid DEFAULT NULL,
  p_status text DEFAULT '',
  p_show_all boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  contact_number text,
  vehicle_number text,
  vehicle_model text,
  service_type text,
  priority text,
  lead_status text,
  complaint_status text,
  address text,
  pincode text,
  location_link text,
  latitude numeric,
  longitude numeric,
  media_upload text[],
  customer_quoted_amount numeric,
  advance_payment text,
  is_premium boolean,
  registered_by_id uuid,
  registered_by_name text,
  assigned_manager_id uuid,
  assigned_manager_name text,
  assigned_mechanic_id uuid,
  assigned_mechanic_name text,
  assigned_mechanic_contact text,
  requested_at timestamp without time zone,
  lead_registered_at timestamp without time zone,
  assigned_to_manager_at timestamp without time zone,
  mechanic_assigned_datetime timestamp without time zone,
  mechanic_reached_datetime timestamp without time zone,
  mechanic_completed_datetime timestamp without time zone,
  assigned_remark text,
  dispatch_remark text,
  reached_remark text,
  complete_remark text,
  remark text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.id,
    rl.customer_name,
    rl.contact_number,
    rl.vehicle_number,
    rl.vehicle_model,
    rl.service_type::text,     -- Cast to text
    rl.priority::text,         -- Cast to text
    rl.lead_status::text,      -- Cast to text
    rl.complaint_status,
    rl.address,
    rl.pincode,
    rl.location_link,
    rl.latitude,
    rl.longitude,
    rl.media_upload,
    rl.customer_quoted_amount,
    rl.advance_payment,
    rl.is_premium,
    rl.registered_by_id,
    rl.registered_by_name,
    rl.assigned_manager_id,
    rl.assigned_manager_name,
    rl.assigned_mechanic_id,
    rl.assigned_mechanic_name,
    rl.assigned_mechanic_contact,
    rl.requested_at,
    rl.lead_registered_at,
    rl.assigned_to_manager_at,
    rl.mechanic_assigned_datetime,
    rl.mechanic_reached_datetime,
    rl.mechanic_completed_datetime,
    rl.assigned_remark,
    rl.dispatch_remark,
    rl.reached_remark,
    rl.complete_remark,
    rl.remark
  FROM public.rsa_leads rl
  WHERE rl.delete_status = false
    AND (
      p_show_all = true 
      OR (p_manager_id IS NOT NULL AND rl.assigned_manager_id = p_manager_id)
      OR (p_status = 'unassigned' AND rl.assigned_manager_id IS NULL)
    )
    AND (
      p_status = '' 
      OR rl.lead_status = p_status 
      OR (p_status = 'unassigned' AND rl.assigned_manager_id IS NULL)
    )
  ORDER BY rl.lead_registered_at DESC, rl.requested_at DESC;
END;
$$;

-- 2. Get Registered Leads
CREATE OR REPLACE FUNCTION rsa_manager_get_registered_leads(
  p_manager_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  contact_number text,
  vehicle_number text,
  service_type text,
  priority text,
  lead_status text,
  address text,
  pincode text,
  registered_by_name text,
  lead_registered_at timestamp without time zone,
  requested_at timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.id,
    rl.customer_name,
    rl.contact_number,
    rl.vehicle_number,
    rl.service_type::text,  -- Cast to text
    rl.priority::text,      -- Cast to text
    rl.lead_status::text,   -- Cast to text
    rl.address,
    rl.pincode,
    rl.registered_by_name,
    rl.lead_registered_at,
    rl.requested_at
  FROM public.rsa_leads rl
  WHERE rl.delete_status = false
    AND rl.assigned_manager_id IS NULL
    AND rl.complaint_status = 'registered'
  ORDER BY rl.lead_registered_at DESC, rl.requested_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. Get Lead Detail
CREATE OR REPLACE FUNCTION rsa_manager_get_lead_detail(
  p_lead_id uuid
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  contact_number text,
  alternate_number text,
  vehicle_number text,
  vehicle_model text,
  service_type text,
  priority text,
  problem text,
  description text,
  lead_status text,
  complaint_status text,
  address text,
  pincode text,
  location_link text,
  latitude numeric,
  longitude numeric,
  media_upload text[],
  customer_quoted_amount numeric,
  advance_payment text,
  payment_received numeric,
  payment_to_mechanic numeric,
  drop_location text,
  registered_by_id uuid,
  registered_by_name text,
  assigned_manager_id uuid,
  assigned_manager_name text,
  assigned_mechanic_id uuid,
  assigned_mechanic_name text,
  assigned_mechanic_contact text,
  requested_at timestamp without time zone,
  lead_registered_at timestamp without time zone,
  assigned_to_manager_at timestamp without time zone,
  mechanic_assigned_datetime timestamp without time zone,
  mechanic_reached_datetime timestamp without time zone,
  mechanic_started_datetime timestamp without time zone,
  mechanic_completed_datetime timestamp without time zone,
  assigned_remark text,
  dispatch_remark text,
  reached_remark text,
  complete_remark text,
  remark text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.id,
    rl.customer_name,
    rl.contact_number,
    rl.alternate_number,
    rl.vehicle_number,
    rl.vehicle_model,
    rl.service_type::text,     -- Cast
    rl.priority::text,         -- Cast
    rl.problem,
    rl.description,
    rl.lead_status::text,      -- Cast
    rl.complaint_status,
    rl.address,
    rl.pincode,
    rl.location_link,
    rl.latitude,
    rl.longitude,
    rl.media_upload,
    rl.customer_quoted_amount,
    rl.advance_payment,
    rl.payment_received,
    rl.payment_to_mechanic,
    rl.drop_location,
    rl.registered_by_id,
    rl.registered_by_name,
    rl.assigned_manager_id,
    rl.assigned_manager_name,
    rl.assigned_mechanic_id,
    rl.assigned_mechanic_name,
    rl.assigned_mechanic_contact,
    rl.requested_at,
    rl.lead_registered_at,
    rl.assigned_to_manager_at,
    rl.mechanic_assigned_datetime,
    rl.mechanic_reached_datetime,
    rl.mechanic_started_datetime,
    rl.mechanic_completed_datetime,
    rl.assigned_remark,
    rl.dispatch_remark,
    rl.reached_remark,
    rl.complete_remark,
    rl.remark
  FROM public.rsa_leads rl
  WHERE rl.id = p_lead_id AND rl.delete_status = false;
END;
$$;

-- Grant permissions again just in case
GRANT EXECUTE ON FUNCTION rsa_manager_get_all_leads(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_registered_leads(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_lead_detail(uuid) TO authenticated;

