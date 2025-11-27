-- ============================================
-- RSA_MANAGER Role Implementation
-- Complete database schema for RSA Manager functionality
-- ============================================

-- ============================================
-- PART 1: TABLES
-- ============================================

-- Company Mechanic RSA Table (Created first due to foreign key dependency)
CREATE TABLE IF NOT EXISTS public.company_mechanic_rsa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_code text UNIQUE NOT NULL,
  mechanic_name text NOT NULL,
  number text NOT NULL,
  alternate_number1 text,
  alternate_number2 text,
  service_tag text, -- Primary service tag
  service_tag2 text, -- Secondary service tag
  service_tag3 text, -- Tertiary service tag
  timing text, -- Availability timing
  active boolean DEFAULT true,
  service_areas text[], -- Array of pincodes/areas
  latitude numeric,
  longitude numeric,
  current_location text,
  is_available boolean DEFAULT true,
  current_assignment_id uuid, -- Current RSA lead assigned (will be set after rsa_leads table is created)
  rating numeric DEFAULT 0,
  total_jobs_completed integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_code ON public.company_mechanic_rsa(mechanic_code);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_active ON public.company_mechanic_rsa(active);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_available ON public.company_mechanic_rsa(is_available);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_service_tags ON public.company_mechanic_rsa(service_tag);

-- RSA Leads Table
CREATE TABLE IF NOT EXISTS public.rsa_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Information
  customer_id uuid,
  customer_name text NOT NULL,
  contact_number text NOT NULL,
  alternate_number text,
  address text,
  pincode text,
  
  -- Vehicle Information
  vehicle_id uuid,
  vehicle_number text,
  vehicle_model text,
  
  -- Service Details
  service_type character varying, -- 'breakdown', 'flat_tire', 'battery', 'fuel', 'towing', etc.
  service_tag text,
  priority character varying DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  problem text,
  description text,
  
  -- Status Tracking
  lead_status character varying DEFAULT 'pending', -- 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'
  complaint_status text DEFAULT 'registered', -- 'registered', 'assigned_to_manager', 'assigned_to_mechanic', 'in_progress', 'completed', 'closed'
  
  -- Manager Tracking (RSA_MANAGER)
  registered_by_id uuid, -- Who registered the lead (could be TELECALLER, CSE, etc.)
  registered_by_name text,
  lead_registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  
  -- RSA Manager Assignment
  assigned_manager_id uuid, -- RSA_MANAGER assigned
  assigned_manager_name text,
  assigned_to_manager_at timestamp without time zone,
  
  -- Company Mechanic Assignment
  assigned_mechanic_id uuid REFERENCES public.company_mechanic_rsa(id), -- COMPANY_MECHANIC_RSA assigned
  assigned_mechanic_name text,
  assigned_mechanic_contact text,
  mechanic_assigned_datetime timestamp without time zone,
  mechanic_reached_datetime timestamp without time zone,
  mechanic_started_datetime timestamp without time zone,
  mechanic_completed_datetime timestamp without time zone,
  mechanic_cancelled_datetime timestamp without time zone,
  mechanic_location text,
  mechanic_notes text,
  mechanic_completion_notes text,
  mechanic_cancellation_reason text,
  
  -- Payment Information
  customer_quoted_amount numeric,
  advance_payment text,
  payment_received numeric,
  payment_to_mechanic numeric,
  
  -- Location & Media
  location_link text, -- Google Maps link
  drop_location text, -- For towing services
  latitude numeric,
  longitude numeric,
  media_upload text[], -- Array of media URLs
  
  -- Additional Fields
  source text, -- 'phone', 'app', 'website', etc.
  remark text,
  assigned_remark text,
  dispatch_remark text,
  reached_remark text,
  complete_remark text,
  cancelled_remark text,
  is_premium boolean DEFAULT false,
  
  -- Timestamps
  requested_at timestamp without time zone DEFAULT now(),
  register_datetime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  expected_completion_date date,
  updated_at timestamp without time zone DEFAULT now(),
  cancelled_at timestamp without time zone,
  
  -- Soft Delete
  delete_status boolean DEFAULT false,
  
  -- Foreign Keys
  CONSTRAINT fk_rsa_leads_customer FOREIGN KEY (customer_id) REFERENCES public.users_login(id),
  CONSTRAINT fk_rsa_leads_registered_by FOREIGN KEY (registered_by_id) REFERENCES public.users_login(id),
  CONSTRAINT fk_rsa_leads_assigned_manager FOREIGN KEY (assigned_manager_id) REFERENCES public.users_login(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rsa_leads_status ON public.rsa_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_assigned_manager ON public.rsa_leads(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_assigned_mechanic ON public.rsa_leads(assigned_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_registered_at ON public.rsa_leads(lead_registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_pincode ON public.rsa_leads(pincode);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_complaint_status ON public.rsa_leads(complaint_status);

-- Add foreign key constraint for company_mechanic_rsa.current_assignment_id after rsa_leads is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_company_mechanic_current_assignment'
  ) THEN
    ALTER TABLE public.company_mechanic_rsa
      ADD CONSTRAINT fk_company_mechanic_current_assignment 
      FOREIGN KEY (current_assignment_id) REFERENCES public.rsa_leads(id);
  END IF;
END $$;

-- RSA Lead Status History Table
CREATE TABLE IF NOT EXISTS public.rsa_lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsa_lead_id uuid NOT NULL,
  status character varying NOT NULL,
  changed_at timestamp without time zone DEFAULT now(),
  changed_by uuid, -- User who made the change
  notes text, -- Optional notes about the status change
  changed_by_name text,
  
  CONSTRAINT fk_rsa_lead_status_history_lead FOREIGN KEY (rsa_lead_id) 
    REFERENCES public.rsa_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsa_lead_status_history_lead ON public.rsa_lead_status_history(rsa_lead_id);
CREATE INDEX IF NOT EXISTS idx_rsa_lead_status_history_date ON public.rsa_lead_status_history(changed_at DESC);

-- RSA Lead Timeline Table
CREATE TABLE IF NOT EXISTS public.rsa_lead_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  status text NOT NULL,
  status_description text,
  updated_by_id uuid,
  updated_by_name text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT fk_rsa_lead_timeline_lead FOREIGN KEY (lead_id) 
    REFERENCES public.rsa_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsa_lead_timeline_lead ON public.rsa_lead_timeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_rsa_lead_timeline_date ON public.rsa_lead_timeline(updated_at DESC);

-- ============================================
-- PART 2: INSERT RSA_MANAGER ROLE
-- ============================================

INSERT INTO public.roles (role_code, role_name, description, is_active)
VALUES ('RSA_MANAGER', 'RSA Manager', 'Roadside Assistance Manager - Handles RSA leads and assigns company mechanics', true)
ON CONFLICT (role_code) DO UPDATE 
SET role_name = EXCLUDED.role_name,
    description = EXCLUDED.description;

-- ============================================
-- PART 3: DATABASE FUNCTIONS (RPCs)
-- ============================================

-- Function 1: Get All RSA Leads for Manager
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
    rl.service_type,
    rl.priority,
    rl.lead_status,
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

-- Function 2: Get All RSA Managers
CREATE OR REPLACE FUNCTION rsa_manager_get_all_managers()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    COALESCE(u.full_name, u.email)::text as name,
    u.email::text,
    COALESCE(u.phone, '')::text as phone,
    CASE 
      WHEN u.is_active = true THEN true
      ELSE false
    END as active
  FROM public.users_login u
  INNER JOIN public.roles r ON u.role_id = r.id
  WHERE r.role_code = 'RSA_MANAGER'
    AND u.is_active = true
  ORDER BY u.full_name ASC NULLS LAST, u.email ASC;
END;
$$;

-- Function 3: Self-Assign Lead
CREATE OR REPLACE FUNCTION rsa_manager_self_assign_lead(
  p_lead_id uuid,
  p_manager_id uuid,
  p_manager_name text DEFAULT NULL
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamp without time zone := NOW();
  v_current_assignee uuid;
  v_lead_status text;
  v_manager_name text;
BEGIN
  -- Check if lead exists and get current status
  SELECT assigned_manager_id, lead_status INTO v_current_assignee, v_lead_status
  FROM public.rsa_leads
  WHERE id = p_lead_id AND delete_status = false;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Lead not found'::text;
    RETURN;
  END IF;
  
  -- Check if already assigned
  IF v_current_assignee IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Lead is already assigned to another manager'::text;
    RETURN;
  END IF;
  
  -- Get manager name if not provided
  IF p_manager_name IS NULL THEN
    SELECT COALESCE(u.full_name, u.email) INTO v_manager_name
    FROM public.users_login u
    WHERE u.id = p_manager_id;
  ELSE
    v_manager_name := p_manager_name;
  END IF;
  
  -- Assign lead
  UPDATE public.rsa_leads
  SET 
    assigned_manager_id = p_manager_id,
    assigned_manager_name = v_manager_name,
    assigned_to_manager_at = v_now,
    complaint_status = 'assigned_to_manager',
    updated_at = v_now
  WHERE id = p_lead_id;
  
  -- Add to timeline
  INSERT INTO public.rsa_lead_timeline (lead_id, status, status_description, updated_by_id, updated_by_name)
  VALUES (p_lead_id, 'assigned_to_manager', 'Lead self-assigned by ' || v_manager_name, p_manager_id, v_manager_name);
  
  -- Add to status history
  INSERT INTO public.rsa_lead_status_history (rsa_lead_id, status, changed_by, changed_by_name, notes)
  VALUES (p_lead_id, 'assigned_to_manager', p_manager_id, v_manager_name, 'Self-assigned by manager');
  
  RETURN QUERY SELECT true, 'Lead assigned successfully'::text;
END;
$$;

-- Function 4: Assign Lead to Another Manager
CREATE OR REPLACE FUNCTION rsa_manager_assign_lead(
  p_lead_id uuid,
  p_assigner_id uuid,
  p_target_manager_id uuid,
  p_assigner_name text DEFAULT NULL,
  p_target_manager_name text DEFAULT NULL
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamp without time zone := NOW();
  v_current_assignee uuid;
  v_lead_status text;
  v_target_manager_name text;
  v_assigner_name text;
BEGIN
  -- Check if lead exists
  SELECT assigned_manager_id, lead_status INTO v_current_assignee, v_lead_status
  FROM public.rsa_leads
  WHERE id = p_lead_id AND delete_status = false;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Lead not found'::text;
    RETURN;
  END IF;
  
  -- Get names if not provided
  IF p_target_manager_name IS NULL THEN
    SELECT COALESCE(u.full_name, u.email) INTO v_target_manager_name
    FROM public.users_login u
    WHERE u.id = p_target_manager_id;
  ELSE
    v_target_manager_name := p_target_manager_name;
  END IF;
  
  IF p_assigner_name IS NULL THEN
    SELECT COALESCE(u.full_name, u.email) INTO v_assigner_name
    FROM public.users_login u
    WHERE u.id = p_assigner_id;
  ELSE
    v_assigner_name := p_assigner_name;
  END IF;
  
  -- Update lead
  UPDATE public.rsa_leads
  SET 
    assigned_manager_id = p_target_manager_id,
    assigned_manager_name = v_target_manager_name,
    assigned_to_manager_at = v_now,
    complaint_status = 'assigned_to_manager',
    updated_at = v_now
  WHERE id = p_lead_id;
  
  -- Add to timeline
  INSERT INTO public.rsa_lead_timeline (lead_id, status, status_description, updated_by_id, updated_by_name)
  VALUES (p_lead_id, 'assigned_to_manager', 
    'Lead reassigned from ' || COALESCE(v_current_assignee::text, 'unassigned') || ' to ' || v_target_manager_name, 
    p_assigner_id, v_assigner_name);
  
  -- Add to status history
  INSERT INTO public.rsa_lead_status_history (rsa_lead_id, status, changed_by, changed_by_name, notes)
  VALUES (p_lead_id, 'assigned_to_manager', p_assigner_id, v_assigner_name, 
    'Reassigned to ' || v_target_manager_name);
  
  RETURN QUERY SELECT true, 'Lead assigned successfully'::text;
END;
$$;

-- Function 5: Assign Company Mechanic
CREATE OR REPLACE FUNCTION rsa_manager_assign_mechanic(
  p_lead_id uuid,
  p_mechanic_id uuid,
  p_payment_amount numeric DEFAULT NULL,
  p_remark text DEFAULT NULL
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamp without time zone := NOW();
  v_mechanic_name text;
  v_mechanic_contact text;
  v_manager_id uuid;
  v_manager_name text;
BEGIN
  -- Get mechanic details
  SELECT mechanic_name, number INTO v_mechanic_name, v_mechanic_contact
  FROM public.company_mechanic_rsa
  WHERE id = p_mechanic_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Mechanic not found or inactive'::text;
    RETURN;
  END IF;
  
  -- Get manager details
  SELECT assigned_manager_id, assigned_manager_name INTO v_manager_id, v_manager_name
  FROM public.rsa_leads
  WHERE id = p_lead_id AND delete_status = false;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Lead not found'::text;
    RETURN;
  END IF;
  
  -- Update lead with mechanic assignment
  UPDATE public.rsa_leads
  SET 
    assigned_mechanic_id = p_mechanic_id,
    assigned_mechanic_name = v_mechanic_name,
    assigned_mechanic_contact = v_mechanic_contact,
    mechanic_assigned_datetime = v_now,
    complaint_status = 'assigned_to_mechanic',
    payment_to_mechanic = COALESCE(p_payment_amount, payment_to_mechanic),
    assigned_remark = COALESCE(p_remark, assigned_remark),
    updated_at = v_now
  WHERE id = p_lead_id;
  
  -- Update mechanic's current assignment
  UPDATE public.company_mechanic_rsa
  SET 
    current_assignment_id = p_lead_id,
    is_available = false,
    updated_at = v_now
  WHERE id = p_mechanic_id;
  
  -- Add to timeline
  INSERT INTO public.rsa_lead_timeline (lead_id, status, status_description, updated_by_id, updated_by_name)
  VALUES (p_lead_id, 'assigned_to_mechanic', 
    'Mechanic ' || v_mechanic_name || ' assigned by ' || v_manager_name, 
    v_manager_id, v_manager_name);
  
  -- Add to status history
  INSERT INTO public.rsa_lead_status_history (rsa_lead_id, status, changed_by, changed_by_name, notes)
  VALUES (p_lead_id, 'assigned_to_mechanic', v_manager_id, v_manager_name, 
    'Mechanic assigned: ' || v_mechanic_name || COALESCE(' | Payment: ' || p_payment_amount::text, ''));
  
  RETURN QUERY SELECT true, 'Mechanic assigned successfully'::text;
END;
$$;

-- Function 6: Search Company Mechanics
CREATE OR REPLACE FUNCTION rsa_manager_search_mechanics(
  p_pincode text DEFAULT NULL,
  p_service_tag text DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  mechanic_code text,
  mechanic_name text,
  number text,
  alternate_number1 text,
  alternate_number2 text,
  service_tag text,
  service_tag2 text,
  service_tag3 text,
  timing text,
  active boolean,
  service_areas text[],
  is_available boolean,
  rating numeric,
  total_jobs_completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.mechanic_code,
    m.mechanic_name,
    m.number,
    m.alternate_number1,
    m.alternate_number2,
    m.service_tag,
    m.service_tag2,
    m.service_tag3,
    m.timing,
    m.active,
    m.service_areas,
    m.is_available,
    m.rating,
    m.total_jobs_completed
  FROM public.company_mechanic_rsa m
  WHERE m.active = true
    AND (
      p_pincode IS NULL 
      OR p_pincode = ANY(m.service_areas)
      OR array_length(m.service_areas, 1) IS NULL
    )
    AND (
      p_service_tag IS NULL 
      OR m.service_tag = p_service_tag
      OR m.service_tag2 = p_service_tag
      OR m.service_tag3 = p_service_tag
    )
    AND (
      p_search_term IS NULL
      OR m.mechanic_name ILIKE '%' || p_search_term || '%'
      OR m.mechanic_code ILIKE '%' || p_search_term || '%'
      OR m.number ILIKE '%' || p_search_term || '%'
    )
  ORDER BY 
    m.is_available DESC,
    m.rating DESC,
    m.total_jobs_completed DESC,
    m.mechanic_name ASC;
END;
$$;

-- Function 7: Get Lead Detail
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
    rl.service_type,
    rl.priority,
    rl.problem,
    rl.description,
    rl.lead_status,
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

-- Function 8: Get Lead Timeline
CREATE OR REPLACE FUNCTION rsa_manager_get_lead_timeline(
  p_lead_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  status_description text,
  updated_by_id uuid,
  updated_by_name text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.status,
    t.status_description,
    t.updated_by_id,
    t.updated_by_name,
    t.updated_at,
    t.created_at
  FROM public.rsa_lead_timeline t
  WHERE t.lead_id = p_lead_id
  ORDER BY t.updated_at DESC, t.created_at DESC;
END;
$$;

-- Function 9: Update Lead Status
CREATE OR REPLACE FUNCTION rsa_manager_update_lead_status(
  p_lead_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager_id uuid;
  v_manager_name text;
BEGIN
  -- Get manager details from lead
  SELECT assigned_manager_id, assigned_manager_name INTO v_manager_id, v_manager_name
  FROM public.rsa_leads
  WHERE id = p_lead_id AND delete_status = false;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Lead not found'::text;
    RETURN;
  END IF;
  
  -- Update lead status
  UPDATE public.rsa_leads
  SET 
    lead_status = p_status,
    complaint_status = p_status,
    updated_at = NOW()
  WHERE id = p_lead_id;
  
  -- Add to timeline
  INSERT INTO public.rsa_lead_timeline (lead_id, status, status_description, updated_by_id, updated_by_name)
  VALUES (p_lead_id, p_status, COALESCE(p_notes, 'Status updated to ' || p_status), v_manager_id, v_manager_name);
  
  -- Add to status history
  INSERT INTO public.rsa_lead_status_history (rsa_lead_id, status, changed_by, changed_by_name, notes)
  VALUES (p_lead_id, p_status, v_manager_id, v_manager_name, COALESCE(p_notes, 'Status updated'));
  
  RETURN QUERY SELECT true, 'Status updated successfully'::text;
END;
$$;

-- Function 10: Get Manager Statistics
CREATE OR REPLACE FUNCTION rsa_manager_get_statistics(
  p_manager_id uuid
)
RETURNS TABLE (
  total_leads integer,
  pending_leads integer,
  completed_leads integer,
  cancelled_leads integer,
  assigned_to_me integer,
  unassigned_leads integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_leads,
    COUNT(*) FILTER (WHERE lead_status = 'pending')::integer as pending_leads,
    COUNT(*) FILTER (WHERE lead_status = 'completed')::integer as completed_leads,
    COUNT(*) FILTER (WHERE lead_status = 'cancelled')::integer as cancelled_leads,
    COUNT(*) FILTER (WHERE assigned_manager_id = p_manager_id)::integer as assigned_to_me,
    COUNT(*) FILTER (WHERE assigned_manager_id IS NULL)::integer as unassigned_leads
  FROM public.rsa_leads
  WHERE delete_status = false;
END;
$$;

-- Function 11: Get Registered/Unassigned Leads
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
    rl.service_type,
    rl.priority,
    rl.lead_status,
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

-- ============================================
-- PART 4: GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION rsa_manager_get_all_leads TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_all_managers TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_self_assign_lead TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_assign_lead TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_assign_mechanic TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_search_mechanics TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_lead_detail TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_lead_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_update_lead_status TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION rsa_manager_get_registered_leads TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.rsa_leads TO authenticated;
GRANT SELECT, INSERT ON public.rsa_lead_status_history TO authenticated;
GRANT SELECT, INSERT ON public.rsa_lead_timeline TO authenticated;
GRANT SELECT ON public.company_mechanic_rsa TO authenticated;
GRANT UPDATE ON public.company_mechanic_rsa TO authenticated;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE public.rsa_leads IS 'RSA (Roadside Assistance) leads managed by RSA_MANAGER role';
COMMENT ON TABLE public.rsa_lead_status_history IS 'History of status changes for RSA leads';
COMMENT ON TABLE public.rsa_lead_timeline IS 'Timeline of events for RSA leads';
COMMENT ON TABLE public.company_mechanic_rsa IS 'Company mechanics available for RSA assignments';

