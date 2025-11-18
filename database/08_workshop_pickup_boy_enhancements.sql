-- ============================================
-- WORKSHOP PICKUP BOY ROLE - COMPLETE FUNCTIONALITY
-- Database schema for pickup/drop operations with OTP verification
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Pickup Status (Detailed workflow)
CREATE TYPE pickup_status AS ENUM (
  'NOT_ASSIGNED',
  'PENDING',
  'OTP_VERIFIED',
  'PICKED',
  'IN_TRANSIT',
  'ARRIVED_AT_WORKSHOP',
  'DROPPED',
  'FAILED_PICKUP'
);

-- Drop Status
CREATE TYPE drop_status AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED_DROP'
);

-- Payment Mode
CREATE TYPE payment_mode AS ENUM (
  'ONLINE',
  'COD',
  'UPI',
  'CARD',
  'WALLET',
  'PENDING'
);

-- Incident Type
CREATE TYPE incident_type AS ENUM (
  'WRONG_CUSTOMER',
  'VEHICLE_NOT_AVAILABLE',
  'CUSTOMER_REFUSED',
  'WRONG_ADDRESS',
  'CUSTOMER_AGGRESSIVE',
  'SAFETY_ISSUE',
  'ACCIDENT',
  'VEHICLE_DAMAGE',
  'OTHER'
);

-- ============================================
-- TABLES
-- ============================================

-- Pickup Boy OTP Management
CREATE TABLE public.pickup_otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  otp_type character varying NOT NULL, -- 'PICKUP', 'DROP'
  otp_code character varying(6) NOT NULL,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  verified_by uuid,
  expires_at timestamp with time zone NOT NULL,
  resend_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pickup_otps_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_otps_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT pickup_otps_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users_login(id)
);

-- Pickup Boy Tracking (Extended lead tracking)
CREATE TABLE public.pickup_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL UNIQUE,
  pickup_required boolean DEFAULT true,
  drop_required boolean DEFAULT false,
  
  -- Pickup workflow fields
  pickup_status pickup_status DEFAULT 'NOT_ASSIGNED',
  pickup_assigned_to uuid,
  pickup_assigned_at timestamp with time zone,
  pickup_start_time timestamp with time zone,
  pickup_otp character varying(6),
  pickup_otp_verified_at timestamp with time zone,
  pickup_picked_time timestamp with time zone,
  pickup_arrival_time timestamp with time zone,
  pickup_address text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  pickup_distance numeric, -- in kilometers
  pickup_time_window_start timestamp with time zone,
  pickup_time_window_end timestamp with time zone,
  pickup_notes text,
  pickup_customer_instructions text,
  
  -- Drop workflow fields
  drop_status drop_status DEFAULT 'NOT_REQUIRED',
  drop_assigned_to uuid,
  drop_assigned_at timestamp with time zone,
  drop_start_time timestamp with time zone,
  drop_otp character varying(6),
  drop_otp_verified_at timestamp with time zone,
  drop_completed_time timestamp with time zone,
  drop_address text,
  drop_latitude numeric,
  drop_longitude numeric,
  drop_notes text,
  
  -- Payment tracking
  payment_mode payment_mode DEFAULT 'PENDING',
  payment_amount numeric,
  payment_collected_at timestamp with time zone,
  payment_proof_url text,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT pickup_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_tracking_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT pickup_tracking_pickup_assigned_to_fkey FOREIGN KEY (pickup_assigned_to) REFERENCES public.users_login(id),
  CONSTRAINT pickup_tracking_drop_assigned_to_fkey FOREIGN KEY (drop_assigned_to) REFERENCES public.users_login(id)
);

-- Pickup Boy Location Tracking (Real-time tracking)
CREATE TABLE public.pickup_location_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  pickup_boy_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  speed numeric,
  heading numeric,
  status character varying NOT NULL, -- 'IDLE', 'MOVING_TO_PICKUP', 'AT_PICKUP', 'IN_TRANSIT_TO_WORKSHOP', 'AT_WORKSHOP', 'MOVING_TO_DROP', 'AT_DROP'
  battery_level integer,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT pickup_location_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_location_tracking_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT pickup_location_tracking_pickup_boy_id_fkey FOREIGN KEY (pickup_boy_id) REFERENCES public.users_login(id)
);

-- Vehicle Condition Photos
CREATE TABLE public.vehicle_condition_photos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  photo_type character varying NOT NULL, -- 'PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_REAR', 'PICKUP_INTERIOR', 'PICKUP_ODOMETER', 'PICKUP_FUEL', 'PICKUP_DAMAGE', 'DROP_FRONT', 'DROP_LEFT', 'DROP_RIGHT', 'DROP_REAR', 'DROP_INTERIOR', 'DROP_ODOMETER', 'AFTER_WORK'
  photo_url text NOT NULL,
  thumbnail_url text,
  uploaded_by uuid NOT NULL,
  odometer_reading integer,
  fuel_level character varying, -- 'EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTER', 'FULL'
  damage_description text,
  latitude numeric,
  longitude numeric,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT vehicle_condition_photos_pkey PRIMARY KEY (id),
  CONSTRAINT vehicle_condition_photos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT vehicle_condition_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_login(id)
);

-- Incident Reports
CREATE TABLE public.pickup_incidents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  incident_type incident_type NOT NULL,
  description text NOT NULL,
  location_address text,
  latitude numeric,
  longitude numeric,
  severity character varying NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  photo_urls text[], -- Array of photo URLs
  status character varying DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  notified_users uuid[], -- Array of user IDs who were notified
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pickup_incidents_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_incidents_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT pickup_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users_login(id),
  CONSTRAINT pickup_incidents_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users_login(id)
);

-- Pickup Boy Performance Metrics
CREATE TABLE public.pickup_boy_metrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pickup_boy_id uuid NOT NULL,
  date date NOT NULL,
  total_pickups integer DEFAULT 0,
  completed_pickups integer DEFAULT 0,
  failed_pickups integer DEFAULT 0,
  total_drops integer DEFAULT 0,
  completed_drops integer DEFAULT 0,
  failed_drops integer DEFAULT 0,
  avg_pickup_time numeric, -- in minutes
  avg_drop_time numeric, -- in minutes
  punctuality_score numeric, -- 0-100
  otp_success_rate numeric, -- 0-100
  photo_compliance_rate numeric, -- 0-100
  customer_complaints integer DEFAULT 0,
  distance_traveled numeric, -- in kilometers
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pickup_boy_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_boy_metrics_pickup_boy_id_fkey FOREIGN KEY (pickup_boy_id) REFERENCES public.users_login(id),
  CONSTRAINT pickup_boy_metrics_unique_date UNIQUE (pickup_boy_id, date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_pickup_otps_lead_id ON public.pickup_otps(lead_id);
CREATE INDEX idx_pickup_otps_otp_code ON public.pickup_otps(otp_code);
CREATE INDEX idx_pickup_otps_expires_at ON public.pickup_otps(expires_at);

CREATE INDEX idx_pickup_tracking_lead_id ON public.pickup_tracking(lead_id);
CREATE INDEX idx_pickup_tracking_pickup_status ON public.pickup_tracking(pickup_status);
CREATE INDEX idx_pickup_tracking_drop_status ON public.pickup_tracking(drop_status);
CREATE INDEX idx_pickup_tracking_pickup_assigned_to ON public.pickup_tracking(pickup_assigned_to);
CREATE INDEX idx_pickup_tracking_drop_assigned_to ON public.pickup_tracking(drop_assigned_to);

CREATE INDEX idx_pickup_location_tracking_lead_id ON public.pickup_location_tracking(lead_id);
CREATE INDEX idx_pickup_location_tracking_pickup_boy_id ON public.pickup_location_tracking(pickup_boy_id);
CREATE INDEX idx_pickup_location_tracking_timestamp ON public.pickup_location_tracking(timestamp);

CREATE INDEX idx_vehicle_condition_photos_lead_id ON public.vehicle_condition_photos(lead_id);
CREATE INDEX idx_vehicle_condition_photos_photo_type ON public.vehicle_condition_photos(photo_type);

CREATE INDEX idx_pickup_incidents_lead_id ON public.pickup_incidents(lead_id);
CREATE INDEX idx_pickup_incidents_status ON public.pickup_incidents(status);
CREATE INDEX idx_pickup_incidents_reported_by ON public.pickup_incidents(reported_by);

CREATE INDEX idx_pickup_boy_metrics_pickup_boy_id ON public.pickup_boy_metrics(pickup_boy_id);
CREATE INDEX idx_pickup_boy_metrics_date ON public.pickup_boy_metrics(date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate pickup OTP
CREATE OR REPLACE FUNCTION generate_pickup_otp(
  p_lead_id uuid,
  p_otp_type character varying
)
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
  v_otp character varying(6);
  v_expires_at timestamp with time zone;
BEGIN
  -- Generate random 6-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  v_expires_at := NOW() + INTERVAL '30 minutes';
  
  -- Insert OTP
  INSERT INTO public.pickup_otps (lead_id, otp_type, otp_code, expires_at)
  VALUES (p_lead_id, p_otp_type, v_otp, v_expires_at);
  
  RETURN v_otp;
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_pickup_otp(
  p_lead_id uuid,
  p_otp_type character varying,
  p_otp_code character varying,
  p_verified_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_valid boolean;
BEGIN
  -- Check if OTP is valid and not expired
  SELECT EXISTS(
    SELECT 1 FROM public.pickup_otps
    WHERE lead_id = p_lead_id
      AND otp_type = p_otp_type
      AND otp_code = p_otp_code
      AND is_verified = false
      AND expires_at > NOW()
  ) INTO v_is_valid;
  
  IF v_is_valid THEN
    -- Mark OTP as verified
    UPDATE public.pickup_otps
    SET is_verified = true,
        verified_at = NOW(),
        verified_by = p_verified_by
    WHERE lead_id = p_lead_id
      AND otp_type = p_otp_type
      AND otp_code = p_otp_code;
      
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Function to calculate pickup metrics
CREATE OR REPLACE FUNCTION calculate_pickup_boy_metrics(
  p_pickup_boy_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_pickups integer;
  v_completed_pickups integer;
  v_failed_pickups integer;
  v_avg_pickup_time numeric;
BEGIN
  -- Calculate metrics
  SELECT 
    COUNT(*) FILTER (WHERE pickup_status != 'NOT_ASSIGNED'),
    COUNT(*) FILTER (WHERE pickup_status = 'DROPPED' OR pickup_status = 'ARRIVED_AT_WORKSHOP'),
    COUNT(*) FILTER (WHERE pickup_status = 'FAILED_PICKUP'),
    AVG(EXTRACT(EPOCH FROM (pickup_arrival_time - pickup_start_time)) / 60.0)
  INTO v_total_pickups, v_completed_pickups, v_failed_pickups, v_avg_pickup_time
  FROM public.pickup_tracking
  WHERE pickup_assigned_to = p_pickup_boy_id
    AND DATE(pickup_assigned_at) = p_date;
  
  -- Insert or update metrics
  INSERT INTO public.pickup_boy_metrics (
    pickup_boy_id, date, total_pickups, completed_pickups, 
    failed_pickups, avg_pickup_time
  )
  VALUES (
    p_pickup_boy_id, p_date, v_total_pickups, v_completed_pickups,
    v_failed_pickups, v_avg_pickup_time
  )
  ON CONFLICT (pickup_boy_id, date) 
  DO UPDATE SET
    total_pickups = v_total_pickups,
    completed_pickups = v_completed_pickups,
    failed_pickups = v_failed_pickups,
    avg_pickup_time = v_avg_pickup_time,
    updated_at = NOW();
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-generate pickup OTP when tracking is created
CREATE OR REPLACE FUNCTION auto_generate_pickup_otp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_required = true AND NEW.pickup_otp IS NULL THEN
    NEW.pickup_otp := generate_pickup_otp(NEW.lead_id, 'PICKUP');
  END IF;
  
  IF NEW.drop_required = true AND NEW.drop_otp IS NULL THEN
    NEW.drop_otp := generate_pickup_otp(NEW.lead_id, 'DROP');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_pickup_otp
BEFORE INSERT ON public.pickup_tracking
FOR EACH ROW
EXECUTE FUNCTION auto_generate_pickup_otp();

-- Trigger to update metrics when pickup status changes
CREATE OR REPLACE FUNCTION update_pickup_metrics_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_status != OLD.pickup_status AND NEW.pickup_assigned_to IS NOT NULL THEN
    PERFORM calculate_pickup_boy_metrics(
      NEW.pickup_assigned_to,
      CURRENT_DATE
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_pickup_metrics
AFTER UPDATE ON public.pickup_tracking
FOR EACH ROW
WHEN (OLD.pickup_status IS DISTINCT FROM NEW.pickup_status)
EXECUTE FUNCTION update_pickup_metrics_on_status_change();

-- ============================================
-- VIEWS
-- ============================================

-- View for pickup boy dashboard
CREATE OR REPLACE VIEW pickup_boy_dashboard AS
SELECT 
  pt.lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.customer_phone,
  sl.vehicle_number,
  sl.vehicle_make,
  sl.vehicle_model,
  pt.pickup_status,
  pt.drop_status,
  pt.pickup_address,
  pt.pickup_time_window_start,
  pt.pickup_time_window_end,
  pt.pickup_distance,
  pt.pickup_assigned_to,
  pt.drop_assigned_to,
  pt.pickup_otp,
  pt.drop_otp,
  -- Count of required photos
  (SELECT COUNT(*) FROM vehicle_condition_photos 
   WHERE lead_id = pt.lead_id AND photo_type LIKE 'PICKUP_%') as pickup_photos_count,
  (SELECT COUNT(*) FROM vehicle_condition_photos 
   WHERE lead_id = pt.lead_id AND photo_type LIKE 'DROP_%') as drop_photos_count,
  pt.created_at,
  pt.updated_at
FROM pickup_tracking pt
JOIN service_leads sl ON pt.lead_id = sl.id
WHERE pt.pickup_status != 'NOT_ASSIGNED' OR pt.drop_status != 'NOT_REQUIRED';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.pickup_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_condition_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_boy_metrics ENABLE ROW LEVEL SECURITY;

-- Pickup boy can only see their own assignments
CREATE POLICY pickup_boy_own_tasks ON public.pickup_tracking
FOR ALL
USING (
  auth.uid() IN (pickup_assigned_to, drop_assigned_to)
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Pickup boy can only see OTPs for their assignments
CREATE POLICY pickup_boy_own_otps ON public.pickup_otps
FOR ALL
USING (
  lead_id IN (
    SELECT lead_id FROM pickup_tracking
    WHERE pickup_assigned_to = auth.uid() OR drop_assigned_to = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- COMMENTS
COMMENT ON TABLE public.pickup_tracking IS 'Tracks complete pickup and drop workflow for each lead';
COMMENT ON TABLE public.pickup_otps IS 'OTP management for secure pickup and drop verification';
COMMENT ON TABLE public.vehicle_condition_photos IS 'Before and after photos of vehicle condition';
COMMENT ON TABLE public.pickup_incidents IS 'Incident reports filed by pickup boys';
COMMENT ON TABLE public.pickup_location_tracking IS 'Real-time location tracking of pickup boys';
COMMENT ON TABLE public.pickup_boy_metrics IS 'Performance metrics and KPIs for pickup boys';


