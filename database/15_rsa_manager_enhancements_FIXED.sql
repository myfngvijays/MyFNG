-- ============================================
-- RSA_MANAGER Role Implementation - FIXED VERSION
-- Complete database schema for RSA Manager functionality
-- ============================================

-- ============================================
-- PART 1: TABLES (Correct Order)
-- ============================================

-- Step 1: Create company_mechanic_rsa FIRST (no foreign keys to other tables)
CREATE TABLE IF NOT EXISTS public.company_mechanic_rsa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_code text UNIQUE NOT NULL,
  mechanic_name text NOT NULL,
  number text NOT NULL,
  alternate_number1 text,
  alternate_number2 text,
  service_tag text,
  service_tag2 text,
  service_tag3 text,
  timing text,
  active boolean DEFAULT true,
  service_areas text[],
  latitude numeric,
  longitude numeric,
  current_location text,
  is_available boolean DEFAULT true,
  current_assignment_id uuid, -- Will add FK constraint later
  rating numeric DEFAULT 0,
  total_jobs_completed integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_code ON public.company_mechanic_rsa(mechanic_code);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_active ON public.company_mechanic_rsa(active);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_available ON public.company_mechanic_rsa(is_available);
CREATE INDEX IF NOT EXISTS idx_company_mechanic_rsa_service_tags ON public.company_mechanic_rsa(service_tag);

-- Step 2: Create rsa_leads (references company_mechanic_rsa)
CREATE TABLE IF NOT EXISTS public.rsa_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text NOT NULL,
  contact_number text NOT NULL,
  alternate_number text,
  address text,
  pincode text,
  vehicle_id uuid,
  vehicle_number text,
  vehicle_model text,
  service_type character varying,
  service_tag text,
  priority character varying DEFAULT 'medium',
  problem text,
  description text,
  lead_status character varying DEFAULT 'pending',
  complaint_status text DEFAULT 'registered',
  registered_by_id uuid,
  registered_by_name text,
  lead_registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  assigned_manager_id uuid,
  assigned_manager_name text,
  assigned_to_manager_at timestamp without time zone,
  assigned_mechanic_id uuid REFERENCES public.company_mechanic_rsa(id),
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
  customer_quoted_amount numeric,
  advance_payment text,
  payment_received numeric,
  payment_to_mechanic numeric,
  location_link text,
  drop_location text,
  latitude numeric,
  longitude numeric,
  media_upload text[],
  source text,
  remark text,
  assigned_remark text,
  dispatch_remark text,
  reached_remark text,
  complete_remark text,
  cancelled_remark text,
  is_premium boolean DEFAULT false,
  requested_at timestamp without time zone DEFAULT now(),
  register_datetime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  expected_completion_date date,
  updated_at timestamp without time zone DEFAULT now(),
  cancelled_at timestamp without time zone,
  delete_status boolean DEFAULT false,
  CONSTRAINT fk_rsa_leads_customer FOREIGN KEY (customer_id) REFERENCES public.users_login(id),
  CONSTRAINT fk_rsa_leads_registered_by FOREIGN KEY (registered_by_id) REFERENCES public.users_login(id),
  CONSTRAINT fk_rsa_leads_assigned_manager FOREIGN KEY (assigned_manager_id) REFERENCES public.users_login(id)
);

CREATE INDEX IF NOT EXISTS idx_rsa_leads_status ON public.rsa_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_assigned_manager ON public.rsa_leads(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_assigned_mechanic ON public.rsa_leads(assigned_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_registered_at ON public.rsa_leads(lead_registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_pincode ON public.rsa_leads(pincode);
CREATE INDEX IF NOT EXISTS idx_rsa_leads_complaint_status ON public.rsa_leads(complaint_status);

-- Step 3: Add foreign key from company_mechanic_rsa to rsa_leads
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

-- Step 4: Create other tables that depend on rsa_leads
CREATE TABLE IF NOT EXISTS public.rsa_lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsa_lead_id uuid NOT NULL,
  status character varying NOT NULL,
  changed_at timestamp without time zone DEFAULT now(),
  changed_by uuid,
  notes text,
  changed_by_name text,
  CONSTRAINT fk_rsa_lead_status_history_lead FOREIGN KEY (rsa_lead_id) 
    REFERENCES public.rsa_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsa_lead_status_history_lead ON public.rsa_lead_status_history(rsa_lead_id);
CREATE INDEX IF NOT EXISTS idx_rsa_lead_status_history_date ON public.rsa_lead_status_history(changed_at DESC);

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
-- (Copy all the functions from the original file - they should work fine)

