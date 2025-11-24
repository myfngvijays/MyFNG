-- ============================================
-- CREATE MECHANIC_JOBS TABLE - SIMPLIFIED VERSION
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, create the enum types if they don't exist
DO $$ BEGIN
  CREATE TYPE mechanic_job_status AS ENUM (
    'ASSIGNED',
    'IN_PROGRESS',
    'HOLD',
    'WAITING_APPROVAL',
    'COMPLETED',
    'READY_FOR_DELIVERY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE job_priority AS ENUM (
    'NORMAL',
    'HIGH',
    'URGENT',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create mechanic_jobs table
CREATE TABLE IF NOT EXISTS public.mechanic_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL UNIQUE,
  mechanic_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  
  -- Job details
  job_priority job_priority DEFAULT 'NORMAL',
  mechanic_status mechanic_job_status DEFAULT 'ASSIGNED',
  
  -- Timeline tracking
  assigned_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  paused_at timestamp with time zone,
  completed_at timestamp with time zone,
  marked_ready_at timestamp with time zone,
  
  -- SLA tracking
  expected_completion_time timestamp with time zone,
  sla_remaining_minutes integer,
  
  -- Work tracking
  work_notes text,
  mechanic_observations text,
  issues_found text,
  technical_notes text,
  hidden_damage_notes text,
  repair_complications text,
  
  -- Checklist completion
  checklist_completed boolean DEFAULT false,
  checklist_completed_at timestamp with time zone,
  
  -- Media upload requirements
  min_before_images integer DEFAULT 3,
  min_progress_images integer DEFAULT 2,
  min_after_images integer DEFAULT 3,
  before_images_count integer DEFAULT 0,
  progress_images_count integer DEFAULT 0,
  after_images_count integer DEFAULT 0,
  
  -- Quality flags
  images_approved boolean DEFAULT false,
  work_approved boolean DEFAULT false,
  qc_passed boolean DEFAULT false,
  
  -- Performance metrics
  actual_work_duration integer,
  pause_duration integer,
  efficiency_score numeric,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_jobs_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_jobs_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users_login(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mechanic_jobs_mechanic_id ON public.mechanic_jobs(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_jobs_lead_id ON public.mechanic_jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_jobs_status ON public.mechanic_jobs(mechanic_status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.mechanic_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Mechanics can view their own jobs" ON public.mechanic_jobs;
  CREATE POLICY "Mechanics can view their own jobs" ON public.mechanic_jobs
    FOR SELECT USING (
      auth.uid() IN (
        SELECT id FROM users_login WHERE id = mechanic_jobs.mechanic_id
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Supervisors and admins can view all jobs in their workshop" ON public.mechanic_jobs;
  CREATE POLICY "Supervisors and admins can view all jobs in their workshop" ON public.mechanic_jobs
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        INNER JOIN users_login mechanic ON mechanic.id = mechanic_jobs.mechanic_id
        WHERE ul.id = auth.uid()
        AND ul.workshop_id = mechanic.workshop_id
        AND ul.role_id IN (
          SELECT id FROM roles WHERE role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
        )
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Super admins can view all jobs" ON public.mechanic_jobs;
  CREATE POLICY "Super admins can view all jobs" ON public.mechanic_jobs
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM users_login ul
        INNER JOIN roles r ON r.id = ul.role_id
        WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the mechanic_dashboard view
CREATE OR REPLACE VIEW mechanic_dashboard AS
SELECT 
  mj.id as job_id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.customer_phone,
  sl.vehicle_number,
  sl.vehicle_make,
  sl.vehicle_model,
  sl.vehicle_variant,
  sl.vehicle_fuel_type,
  sl.problem_description,
  sl.service_type_ids,
  sl.subservice_ids,
  mj.mechanic_status,
  mj.job_priority,
  mj.assigned_at,
  mj.started_at,
  mj.completed_at,
  mj.expected_completion_time,
  mj.sla_remaining_minutes,
  mj.work_notes,
  mj.mechanic_observations,
  mj.issues_found,
  mj.checklist_completed,
  mj.before_images_count,
  mj.progress_images_count,
  mj.after_images_count,
  mj.min_before_images,
  mj.min_progress_images,
  mj.min_after_images,
  mj.mechanic_id,
  sl.workshop_id,
  sl.pickup_required,
  sl.pickup_status,
  sl.status as lead_status,
  mj.created_at,
  mj.updated_at
FROM mechanic_jobs mj
JOIN service_leads sl ON mj.lead_id = sl.id
WHERE mj.mechanic_status NOT IN ('COMPLETED', 'READY_FOR_DELIVERY')
ORDER BY mj.assigned_at DESC;

-- Grant permissions
GRANT SELECT ON mechanic_dashboard TO authenticated;
GRANT ALL ON mechanic_jobs TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'mechanic_jobs table and mechanic_dashboard view created successfully!';
END $$;

