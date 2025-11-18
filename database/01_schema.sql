-- ============================================
-- MyFNG Database Schema
-- Complete database structure with all tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- Lead Type Enum
CREATE TYPE lead_type AS ENUM ('NORMAL', 'RSA', 'HOME_SERVICE');

-- Lead Status Enum
CREATE TYPE lead_status AS ENUM (
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

-- Lead Priority Enum
CREATE TYPE lead_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Pickup Task Type Enum
CREATE TYPE pickup_task_type AS ENUM ('PICKUP', 'DELIVERY', 'BOTH');

-- Pickup Task Status Enum
CREATE TYPE pickup_task_status AS ENUM (
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED'
);

-- Data Deletion Request Status
CREATE TYPE deletion_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- ============================================
-- TABLES
-- ============================================

-- Roles Table
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role_code character varying NOT NULL UNIQUE,
  role_name character varying NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- Workshops Table
CREATE TABLE public.workshops (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  address text NOT NULL,
  city character varying NOT NULL,
  state character varying NOT NULL,
  pincode character varying NOT NULL,
  contact_person character varying NOT NULL,
  phone character varying NOT NULL,
  email character varying NOT NULL,
  is_verified boolean DEFAULT false,
  audit_score numeric CHECK (audit_score >= 0::numeric AND audit_score <= 5::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workshops_pkey PRIMARY KEY (id)
);

-- Users Login Table
CREATE TABLE public.users_login (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE CHECK (email::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  phone character varying,
  full_name character varying NOT NULL,
  role_id uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  profile_image text,
  department character varying,
  workshop_id uuid,
  CONSTRAINT users_login_pkey PRIMARY KEY (id),
  CONSTRAINT users_login_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT users_login_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id)
);

-- Service Leads Table
CREATE TABLE public.service_leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_number character varying NOT NULL UNIQUE,
  lead_type lead_type NOT NULL,
  customer_name character varying NOT NULL,
  customer_phone character varying NOT NULL,
  customer_email character varying,
  vehicle_number character varying NOT NULL,
  vehicle_make character varying,
  vehicle_model character varying,
  vehicle_year integer,
  service_type character varying NOT NULL,
  description text,
  estimated_amount numeric,
  actual_amount numeric,
  status lead_status DEFAULT 'NEW'::lead_status,
  priority lead_priority DEFAULT 'MEDIUM'::lead_priority,
  assigned_to_id uuid,
  workshop_id uuid,
  location_latitude numeric,
  location_longitude numeric,
  address text,
  city character varying,
  state character varying,
  pincode character varying,
  notes text,
  internal_notes text,
  assigned_at timestamp with time zone,
  accepted_at timestamp with time zone,
  declined_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_leads_pkey PRIMARY KEY (id),
  CONSTRAINT service_leads_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users_login(id),
  CONSTRAINT service_leads_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id),
  CONSTRAINT service_leads_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users_login(id),
  CONSTRAINT service_leads_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users_login(id)
);

-- Lead Activities Table (History/Audit)
CREATE TABLE public.lead_activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid,
  user_id uuid,
  activity_type character varying NOT NULL,
  description text,
  old_status lead_status,
  new_status lead_status,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lead_activities_pkey PRIMARY KEY (id),
  CONSTRAINT lead_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_login(id)
);

-- Lead Updates Table
CREATE TABLE public.lead_updates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  updated_by uuid NOT NULL,
  update_type character varying NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lead_updates_pkey PRIMARY KEY (id),
  CONSTRAINT lead_updates_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_updates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_login(id)
);

-- Pickup Delivery Tasks Table
CREATE TABLE public.pickup_delivery_tasks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_number character varying NOT NULL UNIQUE,
  task_type pickup_task_type NOT NULL,
  lead_id uuid,
  workshop_id uuid,
  customer_name character varying NOT NULL,
  customer_phone character varying NOT NULL,
  customer_email character varying,
  vehicle_number character varying NOT NULL,
  vehicle_make character varying,
  vehicle_model character varying,
  pickup_address text NOT NULL,
  pickup_latitude numeric,
  pickup_longitude numeric,
  delivery_address text,
  delivery_latitude numeric,
  delivery_longitude numeric,
  assigned_to_id uuid,
  assigned_by_id uuid,
  status pickup_task_status DEFAULT 'PENDING'::pickup_task_status,
  scheduled_time timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  notes text,
  customer_instructions text,
  cancellation_reason text,
  created_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pickup_delivery_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_delivery_tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE SET NULL,
  CONSTRAINT pickup_delivery_tasks_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id),
  CONSTRAINT pickup_delivery_tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users_login(id),
  CONSTRAINT pickup_delivery_tasks_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public.users_login(id),
  CONSTRAINT pickup_delivery_tasks_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users_login(id)
);

-- Audit Logs Table (GDPR Compliance)
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action character varying NOT NULL,
  table_name character varying,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address character varying,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_login(id) ON DELETE SET NULL
);

-- User Consents Table (GDPR Compliance)
CREATE TABLE public.user_consents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  consent_type character varying NOT NULL,
  consent_given boolean DEFAULT false,
  consent_text text,
  ip_address character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_consents_pkey PRIMARY KEY (id),
  CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_login(id) ON DELETE CASCADE
);

-- Data Deletion Requests Table (GDPR Compliance)
CREATE TABLE public.data_deletion_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  email character varying NOT NULL,
  reason text,
  status deletion_request_status DEFAULT 'PENDING'::deletion_request_status,
  requested_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  processed_by uuid,
  CONSTRAINT data_deletion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT data_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_login(id) ON DELETE SET NULL,
  CONSTRAINT data_deletion_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users_login(id)
);

-- Photos/Media Table
CREATE TABLE public.media_files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  related_table character varying NOT NULL,
  related_id uuid NOT NULL,
  file_type character varying NOT NULL, -- 'before_photo', 'after_photo', 'pickup_photo', 'delivery_photo', 'invoice', 'document'
  file_url text NOT NULL,
  file_name character varying,
  file_size integer,
  mime_type character varying,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT media_files_pkey PRIMARY KEY (id),
  CONSTRAINT media_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_login(id)
);

-- Create indexes for performance
CREATE INDEX idx_users_login_email ON public.users_login(email);
CREATE INDEX idx_users_login_role_id ON public.users_login(role_id);
CREATE INDEX idx_users_login_workshop_id ON public.users_login(workshop_id);
CREATE INDEX idx_service_leads_status ON public.service_leads(status);
CREATE INDEX idx_service_leads_lead_type ON public.service_leads(lead_type);
CREATE INDEX idx_service_leads_workshop_id ON public.service_leads(workshop_id);
CREATE INDEX idx_service_leads_assigned_to_id ON public.service_leads(assigned_to_id);
CREATE INDEX idx_pickup_delivery_tasks_status ON public.pickup_delivery_tasks(status);
CREATE INDEX idx_pickup_delivery_tasks_assigned_to_id ON public.pickup_delivery_tasks(assigned_to_id);
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_media_files_related ON public.media_files(related_table, related_id);

-- Comments for documentation
COMMENT ON TABLE public.roles IS 'User roles with permissions';
COMMENT ON TABLE public.users_login IS 'All system users across 17 different roles';
COMMENT ON TABLE public.workshops IS 'Partner workshops';
COMMENT ON TABLE public.service_leads IS 'Service leads (NORMAL, RSA, HOME_SERVICE)';
COMMENT ON TABLE public.lead_activities IS 'Lead activity history for audit trail';
COMMENT ON TABLE public.pickup_delivery_tasks IS 'Pickup and delivery tasks';
COMMENT ON TABLE public.audit_logs IS 'System-wide audit logs for GDPR compliance';
COMMENT ON TABLE public.user_consents IS 'User consent records for GDPR compliance';
COMMENT ON TABLE public.data_deletion_requests IS 'GDPR data deletion requests';
COMMENT ON TABLE public.media_files IS 'Photos and documents (before/after, pickup/delivery)';

