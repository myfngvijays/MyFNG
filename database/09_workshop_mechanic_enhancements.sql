-- ============================================
-- WORKSHOP MECHANIC ROLE - COMPLETE FUNCTIONALITY
-- Database schema for mechanic job management, checklists, media uploads, and KPIs
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Mechanic Job Status (Mechanic's view of the status)
CREATE TYPE mechanic_job_status AS ENUM (
  'ASSIGNED',
  'IN_PROGRESS',
  'HOLD',
  'WAITING_APPROVAL',
  'COMPLETED',
  'READY_FOR_DELIVERY'
);

-- Checklist Item Status
CREATE TYPE checklist_item_status AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'NOT_APPLICABLE'
);

-- Media Category (for mechanic uploads)
CREATE TYPE mechanic_media_category AS ENUM (
  'BEFORE',
  'PROGRESS',
  'AFTER',
  'EXTRA_WORK_PROOF',
  'DAMAGE_FOUND',
  'PARTS_USED'
);

-- Parts Usage Status
CREATE TYPE parts_usage_status AS ENUM (
  'ISSUED',
  'USED',
  'NOT_NEEDED',
  'ADDITIONAL_REQUIRED',
  'DAMAGED',
  'RETURNED'
);

-- Priority Level
CREATE TYPE job_priority AS ENUM (
  'NORMAL',
  'HIGH',
  'URGENT',
  'CRITICAL'
);

-- ============================================
-- TABLES
-- ============================================

-- Mechanic Job Assignments (Extended tracking)
CREATE TABLE public.mechanic_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL UNIQUE,
  mechanic_id uuid NOT NULL,
  assigned_by uuid NOT NULL, -- Supervisor or Admin
  
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
  actual_work_duration integer, -- in minutes
  pause_duration integer, -- in minutes
  efficiency_score numeric,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_jobs_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_jobs_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users_login(id)
);

-- Service Checklists (Dynamic based on service type)
CREATE TABLE public.service_checklists (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  service_type varchar NOT NULL, -- 'FULL_SERVICE', 'AC_SERVICE', 'BRAKE_SERVICE', etc.
  
  -- Checklist items stored as JSONB
  checklist_items jsonb DEFAULT '[]'::jsonb,
  -- Format: [
  --   {
  --     "id": "item1",
  --     "name": "Engine oil drained",
  --     "status": "COMPLETED",
  --     "notes": "Used 5W-30 synthetic",
  --     "completed_at": "2024-01-01T10:00:00Z",
  --     "mandatory": true
  --   }
  -- ]
  
  -- Overall completion
  total_items integer DEFAULT 0,
  completed_items integer DEFAULT 0,
  completion_percentage numeric DEFAULT 0,
  all_mandatory_completed boolean DEFAULT false,
  
  -- Timestamps
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT service_checklists_pkey PRIMARY KEY (id),
  CONSTRAINT service_checklists_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT service_checklists_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id)
);

-- Mechanic Media Uploads
CREATE TABLE public.mechanic_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  
  -- Media details
  media_url text NOT NULL,
  thumbnail_url text,
  media_category mechanic_media_category NOT NULL,
  media_type varchar NOT NULL, -- 'IMAGE', 'VIDEO'
  file_size_kb integer,
  
  -- Metadata
  description text,
  latitude numeric,
  longitude numeric,
  device_info text,
  
  -- Approval tracking
  approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  
  -- Timestamps
  uploaded_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_media_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_media_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_media_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_media_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users_login(id)
);

-- Parts Usage Tracking
CREATE TABLE public.mechanic_parts_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  
  -- Part details
  part_name varchar NOT NULL,
  part_code varchar,
  quantity_issued integer DEFAULT 0,
  quantity_used integer DEFAULT 0,
  usage_status parts_usage_status DEFAULT 'ISSUED',
  
  -- Additional details
  part_notes text,
  replacement_reason text,
  additional_quantity_requested integer,
  
  -- Admin/Supervisor notes
  admin_notes text,
  approved_by uuid,
  
  -- Timestamps
  issued_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_parts_usage_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_parts_usage_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_parts_usage_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_parts_usage_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users_login(id)
);

-- Additional Work Requests (by mechanic)
CREATE TABLE public.mechanic_extra_work_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  
  -- Request details
  issue_description text NOT NULL,
  additional_work_required text NOT NULL,
  estimated_cost numeric,
  priority varchar DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'HIGH', 'URGENT'
  
  -- Supporting evidence
  proof_image_urls text[], -- Array of image URLs
  video_url text,
  
  -- Approval workflow
  status varchar DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'
  reviewed_by uuid,
  review_notes text,
  reviewed_at timestamp with time zone,
  
  -- Completion tracking
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  final_cost numeric,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_extra_work_requests_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_extra_work_requests_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_extra_work_requests_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_extra_work_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users_login(id)
);

-- Mechanic Communication/Chat
CREATE TABLE public.mechanic_chat (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  
  -- Message details
  message_type varchar NOT NULL, -- 'TEXT', 'VOICE_NOTE', 'IMAGE', 'SUPPORT_REQUEST'
  message_text text,
  media_url text,
  
  -- Message metadata
  is_support_request boolean DEFAULT false,
  support_type varchar, -- 'NEED_HELP', 'PART_REPLACEMENT', 'DELAY_NOTIFICATION', 'TECHNICAL_ISSUE'
  
  -- Read tracking
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  
  -- Timestamps
  sent_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_chat_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_chat_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_chat_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_chat_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users_login(id)
);

-- Mechanic KPIs and Performance Metrics
CREATE TABLE public.mechanic_performance_metrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mechanic_id uuid NOT NULL,
  date date NOT NULL,
  
  -- Job completion metrics
  total_jobs_assigned integer DEFAULT 0,
  total_jobs_completed integer DEFAULT 0,
  jobs_in_progress integer DEFAULT 0,
  jobs_on_hold integer DEFAULT 0,
  
  -- Time metrics
  avg_repair_duration numeric, -- in minutes
  total_work_time numeric, -- in minutes
  
  -- Quality metrics
  sla_success_count integer DEFAULT 0,
  sla_breach_count integer DEFAULT 0,
  sla_success_rate numeric DEFAULT 0,
  
  -- Extra work metrics
  extra_work_requests_count integer DEFAULT 0,
  extra_work_approved_count integer DEFAULT 0,
  
  -- Rework metrics
  rework_count integer DEFAULT 0,
  qc_fail_count integer DEFAULT 0,
  qc_pass_count integer DEFAULT 0,
  
  -- Customer impact
  customer_complaints integer DEFAULT 0,
  customer_rating_avg numeric,
  
  -- Service type breakdown (JSONB)
  service_type_stats jsonb DEFAULT '{}'::jsonb,
  -- Format: {
  --   "FULL_SERVICE": {"count": 5, "avg_time": 120},
  --   "AC_SERVICE": {"count": 3, "avg_time": 90}
  -- }
  
  -- Overall performance score (0-100)
  performance_score numeric DEFAULT 0,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_performance_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_performance_metrics_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id),
  CONSTRAINT mechanic_performance_metrics_unique_date UNIQUE (mechanic_id, date)
);

-- Mechanic Actions Log (Audit trail)
CREATE TABLE public.mechanic_actions_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  
  -- Action details
  action_type varchar NOT NULL,
  -- Types: START_JOB, PAUSE_JOB, RESUME_JOB, UPLOAD_IMAGE, UPDATE_CHECKLIST,
  --        REQUEST_EXTRA_WORK, UPDATE_PARTS, ADD_NOTE, MARK_COMPLETED
  
  action_data jsonb,
  description text,
  
  -- Metadata
  ip_address varchar(45),
  user_agent text,
  device_info text,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT mechanic_actions_log_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_actions_log_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.service_leads(id) ON DELETE CASCADE,
  CONSTRAINT mechanic_actions_log_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users_login(id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Mechanic Jobs indexes
CREATE INDEX idx_mechanic_jobs_lead_id ON public.mechanic_jobs(lead_id);
CREATE INDEX idx_mechanic_jobs_mechanic_id ON public.mechanic_jobs(mechanic_id);
CREATE INDEX idx_mechanic_jobs_status ON public.mechanic_jobs(mechanic_status);
CREATE INDEX idx_mechanic_jobs_assigned_by ON public.mechanic_jobs(assigned_by);
CREATE INDEX idx_mechanic_jobs_priority ON public.mechanic_jobs(job_priority);
CREATE INDEX idx_mechanic_jobs_assigned_at ON public.mechanic_jobs(assigned_at DESC);

-- Service Checklists indexes
CREATE INDEX idx_service_checklists_lead_id ON public.service_checklists(lead_id);
CREATE INDEX idx_service_checklists_mechanic_id ON public.service_checklists(mechanic_id);
CREATE INDEX idx_service_checklists_service_type ON public.service_checklists(service_type);

-- Mechanic Media indexes
CREATE INDEX idx_mechanic_media_lead_id ON public.mechanic_media(lead_id);
CREATE INDEX idx_mechanic_media_mechanic_id ON public.mechanic_media(mechanic_id);
CREATE INDEX idx_mechanic_media_category ON public.mechanic_media(media_category);
CREATE INDEX idx_mechanic_media_uploaded_at ON public.mechanic_media(uploaded_at DESC);

-- Parts Usage indexes
CREATE INDEX idx_mechanic_parts_usage_lead_id ON public.mechanic_parts_usage(lead_id);
CREATE INDEX idx_mechanic_parts_usage_mechanic_id ON public.mechanic_parts_usage(mechanic_id);
CREATE INDEX idx_mechanic_parts_usage_status ON public.mechanic_parts_usage(usage_status);

-- Extra Work Requests indexes
CREATE INDEX idx_mechanic_extra_work_requests_lead_id ON public.mechanic_extra_work_requests(lead_id);
CREATE INDEX idx_mechanic_extra_work_requests_mechanic_id ON public.mechanic_extra_work_requests(mechanic_id);
CREATE INDEX idx_mechanic_extra_work_requests_status ON public.mechanic_extra_work_requests(status);
CREATE INDEX idx_mechanic_extra_work_requests_created_at ON public.mechanic_extra_work_requests(created_at DESC);

-- Chat indexes
CREATE INDEX idx_mechanic_chat_lead_id ON public.mechanic_chat(lead_id);
CREATE INDEX idx_mechanic_chat_sender_id ON public.mechanic_chat(sender_id);
CREATE INDEX idx_mechanic_chat_recipient_id ON public.mechanic_chat(recipient_id);
CREATE INDEX idx_mechanic_chat_sent_at ON public.mechanic_chat(sent_at DESC);

-- Performance Metrics indexes
CREATE INDEX idx_mechanic_performance_metrics_mechanic_id ON public.mechanic_performance_metrics(mechanic_id);
CREATE INDEX idx_mechanic_performance_metrics_date ON public.mechanic_performance_metrics(date DESC);

-- Actions Log indexes
CREATE INDEX idx_mechanic_actions_log_lead_id ON public.mechanic_actions_log(lead_id);
CREATE INDEX idx_mechanic_actions_log_mechanic_id ON public.mechanic_actions_log(mechanic_id);
CREATE INDEX idx_mechanic_actions_log_action_type ON public.mechanic_actions_log(action_type);
CREATE INDEX idx_mechanic_actions_log_created_at ON public.mechanic_actions_log(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate service checklist based on service type
CREATE OR REPLACE FUNCTION generate_service_checklist(
  p_lead_id uuid,
  p_mechanic_id uuid,
  p_service_type varchar
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist_id uuid;
  v_checklist_items jsonb;
BEGIN
  -- Generate checklist items based on service type
  CASE p_service_type
    WHEN 'FULL_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "Engine oil drained", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Oil filter replaced", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Air filter inspected/replaced", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Brake system checked", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Coolant level checked", "status": "PENDING", "mandatory": true},
        {"id": "6", "name": "Battery terminals cleaned", "status": "PENDING", "mandatory": false},
        {"id": "7", "name": "Tyre pressure corrected", "status": "PENDING", "mandatory": true},
        {"id": "8", "name": "AC filter cleaned", "status": "PENDING", "mandatory": false},
        {"id": "9", "name": "Suspension inspected", "status": "PENDING", "mandatory": true},
        {"id": "10", "name": "Test drive completed", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    WHEN 'AC_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "AC filter cleaned/replaced", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "AC gas level checked", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Cooling performance tested", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Condenser cleaned", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Blower motor checked", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    WHEN 'BRAKE_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "Brake pads inspected", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Brake fluid checked", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Brake drums/rotors checked", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Brake lines inspected", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Brake test completed", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    ELSE
      v_checklist_items := '[
        {"id": "1", "name": "Service inspection completed", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Required work performed", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Quality check done", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
  END CASE;
  
  -- Insert checklist
  INSERT INTO public.service_checklists (
    lead_id,
    mechanic_id,
    service_type,
    checklist_items,
    total_items,
    completed_items,
    completion_percentage
  )
  VALUES (
    p_lead_id,
    p_mechanic_id,
    p_service_type,
    v_checklist_items,
    jsonb_array_length(v_checklist_items),
    0,
    0
  )
  RETURNING id INTO v_checklist_id;
  
  RETURN v_checklist_id;
END;
$$;

-- Function to update checklist completion
CREATE OR REPLACE FUNCTION update_checklist_completion(
  p_checklist_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist_items jsonb;
  v_total_items integer;
  v_completed_items integer;
  v_completion_percentage numeric;
  v_all_mandatory_completed boolean;
BEGIN
  -- Get checklist items
  SELECT checklist_items, total_items
  INTO v_checklist_items, v_total_items
  FROM public.service_checklists
  WHERE id = p_checklist_id;
  
  -- Count completed items
  SELECT COUNT(*)::integer
  INTO v_completed_items
  FROM jsonb_array_elements(v_checklist_items) AS item
  WHERE item->>'status' = 'COMPLETED';
  
  -- Calculate completion percentage
  IF v_total_items > 0 THEN
    v_completion_percentage := (v_completed_items::numeric / v_total_items::numeric) * 100;
  ELSE
    v_completion_percentage := 0;
  END IF;
  
  -- Check if all mandatory items are completed
  SELECT NOT EXISTS(
    SELECT 1
    FROM jsonb_array_elements(v_checklist_items) AS item
    WHERE (item->>'mandatory')::boolean = true
    AND item->>'status' != 'COMPLETED'
  ) INTO v_all_mandatory_completed;
  
  -- Update checklist
  UPDATE public.service_checklists
  SET 
    completed_items = v_completed_items,
    completion_percentage = v_completion_percentage,
    all_mandatory_completed = v_all_mandatory_completed,
    updated_at = NOW()
  WHERE id = p_checklist_id;
END;
$$;

-- Function to calculate mechanic metrics
CREATE OR REPLACE FUNCTION calculate_mechanic_metrics(
  p_mechanic_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_assigned integer;
  v_total_completed integer;
  v_jobs_in_progress integer;
  v_jobs_on_hold integer;
  v_avg_duration numeric;
  v_sla_success integer;
  v_sla_breach integer;
  v_sla_rate numeric;
  v_extra_work_requests integer;
  v_rework_count integer;
  v_performance_score numeric;
BEGIN
  -- Calculate job metrics
  SELECT 
    COUNT(*) FILTER (WHERE DATE(assigned_at) = p_date),
    COUNT(*) FILTER (WHERE DATE(completed_at) = p_date),
    COUNT(*) FILTER (WHERE mechanic_status = 'IN_PROGRESS' AND DATE(assigned_at) = p_date),
    COUNT(*) FILTER (WHERE mechanic_status IN ('HOLD', 'WAITING_APPROVAL') AND DATE(assigned_at) = p_date),
    AVG(actual_work_duration) FILTER (WHERE DATE(completed_at) = p_date),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at <= expected_completion_time AND DATE(completed_at) = p_date),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at > expected_completion_time AND DATE(completed_at) = p_date)
  INTO 
    v_total_assigned,
    v_total_completed,
    v_jobs_in_progress,
    v_jobs_on_hold,
    v_avg_duration,
    v_sla_success,
    v_sla_breach
  FROM public.mechanic_jobs
  WHERE mechanic_id = p_mechanic_id;
  
  -- Calculate SLA success rate
  IF (v_sla_success + v_sla_breach) > 0 THEN
    v_sla_rate := (v_sla_success::numeric / (v_sla_success + v_sla_breach)::numeric) * 100;
  ELSE
    v_sla_rate := 0;
  END IF;
  
  -- Count extra work requests
  SELECT COUNT(*)::integer
  INTO v_extra_work_requests
  FROM public.mechanic_extra_work_requests
  WHERE mechanic_id = p_mechanic_id
  AND DATE(created_at) = p_date;
  
  -- Count reworks (QC failures)
  SELECT COUNT(*)::integer
  INTO v_rework_count
  FROM public.mechanic_jobs mj
  JOIN public.qc_checks qc ON mj.lead_id = qc.lead_id
  WHERE mj.mechanic_id = p_mechanic_id
  AND qc.qc_status = 'FAILED'
  AND DATE(qc.created_at) = p_date;
  
  -- Calculate overall performance score (weighted)
  v_performance_score := (
    (v_sla_rate * 0.4) + -- 40% weight on SLA
    (LEAST(v_total_completed::numeric / NULLIF(v_total_assigned::numeric, 0) * 100, 100) * 0.3) + -- 30% weight on completion rate
    ((100 - (v_rework_count::numeric / NULLIF(v_total_completed::numeric, 0) * 100)) * 0.3) -- 30% weight on quality (inverse of rework rate)
  );
  
  -- Insert or update metrics
  INSERT INTO public.mechanic_performance_metrics (
    mechanic_id,
    date,
    total_jobs_assigned,
    total_jobs_completed,
    jobs_in_progress,
    jobs_on_hold,
    avg_repair_duration,
    sla_success_count,
    sla_breach_count,
    sla_success_rate,
    extra_work_requests_count,
    rework_count,
    performance_score
  )
  VALUES (
    p_mechanic_id,
    p_date,
    v_total_assigned,
    v_total_completed,
    v_jobs_in_progress,
    v_jobs_on_hold,
    v_avg_duration,
    v_sla_success,
    v_sla_breach,
    v_sla_rate,
    v_extra_work_requests,
    v_rework_count,
    v_performance_score
  )
  ON CONFLICT (mechanic_id, date)
  DO UPDATE SET
    total_jobs_assigned = v_total_assigned,
    total_jobs_completed = v_total_completed,
    jobs_in_progress = v_jobs_in_progress,
    jobs_on_hold = v_jobs_on_hold,
    avg_repair_duration = v_avg_duration,
    sla_success_count = v_sla_success,
    sla_breach_count = v_sla_breach,
    sla_success_rate = v_sla_rate,
    extra_work_requests_count = v_extra_work_requests,
    rework_count = v_rework_count,
    performance_score = v_performance_score,
    updated_at = NOW();
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-generate checklist when job is assigned
CREATE OR REPLACE FUNCTION auto_generate_mechanic_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_type varchar;
BEGIN
  -- Get service type from lead
  SELECT 
    COALESCE(
      service_types[1],
      'GENERAL_SERVICE'
    )
  INTO v_service_type
  FROM public.service_leads
  WHERE id = NEW.lead_id;
  
  -- Generate checklist
  PERFORM generate_service_checklist(
    NEW.lead_id,
    NEW.mechanic_id,
    v_service_type
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_mechanic_checklist
AFTER INSERT ON public.mechanic_jobs
FOR EACH ROW
EXECUTE FUNCTION auto_generate_mechanic_checklist();

-- Trigger to update media counts when images are uploaded
CREATE OR REPLACE FUNCTION update_mechanic_media_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update media counts in mechanic_jobs
  UPDATE public.mechanic_jobs
  SET 
    before_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_media
      WHERE lead_id = NEW.lead_id
      AND media_category = 'BEFORE'
    ),
    progress_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_media
      WHERE lead_id = NEW.lead_id
      AND media_category = 'PROGRESS'
    ),
    after_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_media
      WHERE lead_id = NEW.lead_id
      AND media_category = 'AFTER'
    ),
    updated_at = NOW()
  WHERE lead_id = NEW.lead_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_mechanic_media_counts
AFTER INSERT ON public.mechanic_media
FOR EACH ROW
EXECUTE FUNCTION update_mechanic_media_counts();

-- Trigger to update metrics when job status changes
CREATE OR REPLACE FUNCTION update_mechanic_metrics_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mechanic_status = 'COMPLETED' AND OLD.mechanic_status != 'COMPLETED' THEN
    -- Calculate actual work duration
    NEW.actual_work_duration := EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60.0;
    
    -- Update daily metrics
    PERFORM calculate_mechanic_metrics(
      NEW.mechanic_id,
      CURRENT_DATE
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_mechanic_metrics
BEFORE UPDATE ON public.mechanic_jobs
FOR EACH ROW
WHEN (OLD.mechanic_status IS DISTINCT FROM NEW.mechanic_status)
EXECUTE FUNCTION update_mechanic_metrics_on_completion();

-- Trigger to log mechanic actions
CREATE OR REPLACE FUNCTION log_mechanic_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log status changes
  IF TG_TABLE_NAME = 'mechanic_jobs' AND TG_OP = 'UPDATE' THEN
    IF OLD.mechanic_status IS DISTINCT FROM NEW.mechanic_status THEN
      INSERT INTO public.mechanic_actions_log (
        lead_id,
        mechanic_id,
        action_type,
        action_data,
        description
      ) VALUES (
        NEW.lead_id,
        NEW.mechanic_id,
        'STATUS_CHANGE',
        jsonb_build_object(
          'old_status', OLD.mechanic_status,
          'new_status', NEW.mechanic_status
        ),
        'Status changed from ' || OLD.mechanic_status || ' to ' || NEW.mechanic_status
      );
    END IF;
  END IF;
  
  -- Log media uploads
  IF TG_TABLE_NAME = 'mechanic_media' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.mechanic_actions_log (
      lead_id,
      mechanic_id,
      action_type,
      action_data,
      description
    ) VALUES (
      NEW.lead_id,
      NEW.mechanic_id,
      'UPLOAD_IMAGE',
      jsonb_build_object(
        'media_category', NEW.media_category,
        'media_url', NEW.media_url
      ),
      'Uploaded ' || NEW.media_category || ' image'
    );
  END IF;
  
  -- Log extra work requests
  IF TG_TABLE_NAME = 'mechanic_extra_work_requests' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.mechanic_actions_log (
      lead_id,
      mechanic_id,
      action_type,
      action_data,
      description
    ) VALUES (
      NEW.lead_id,
      NEW.mechanic_id,
      'REQUEST_EXTRA_WORK',
      jsonb_build_object(
        'issue_description', NEW.issue_description,
        'estimated_cost', NEW.estimated_cost
      ),
      'Requested additional work'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_mechanic_job_actions
AFTER UPDATE ON public.mechanic_jobs
FOR EACH ROW
EXECUTE FUNCTION log_mechanic_action();

CREATE TRIGGER trigger_log_mechanic_media_actions
AFTER INSERT ON public.mechanic_media
FOR EACH ROW
EXECUTE FUNCTION log_mechanic_action();

CREATE TRIGGER trigger_log_mechanic_extra_work_actions
AFTER INSERT ON public.mechanic_extra_work_requests
FOR EACH ROW
EXECUTE FUNCTION log_mechanic_action();

-- ============================================
-- VIEWS
-- ============================================

-- View for mechanic dashboard
CREATE OR REPLACE VIEW mechanic_dashboard AS
SELECT 
  mj.id as job_id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  sl.vehicle_number,
  sl.vehicle_make,
  sl.vehicle_model,
  sl.vehicle_variant,
  mj.mechanic_status,
  mj.job_priority,
  mj.assigned_at,
  mj.started_at,
  mj.expected_completion_time,
  mj.sla_remaining_minutes,
  
  -- Service details
  sl.service_types,
  sl.problem_description,
  
  -- Progress indicators
  mj.checklist_completed,
  mj.before_images_count,
  mj.progress_images_count,
  mj.after_images_count,
  mj.min_before_images,
  mj.min_progress_images,
  mj.min_after_images,
  
  -- Flags
  EXISTS(
    SELECT 1 FROM mechanic_extra_work_requests
    WHERE lead_id = mj.lead_id AND status = 'PENDING'
  ) as has_pending_extra_work,
  
  EXISTS(
    SELECT 1 FROM mechanic_parts_usage
    WHERE lead_id = mj.lead_id
  ) as has_parts_assigned,
  
  -- Pickup status (if applicable)
  pt.pickup_status,
  
  mj.mechanic_id,
  mj.created_at,
  mj.updated_at
FROM mechanic_jobs mj
JOIN service_leads sl ON mj.lead_id = sl.id
LEFT JOIN pickup_tracking pt ON mj.lead_id = pt.lead_id
WHERE mj.mechanic_status NOT IN ('COMPLETED', 'READY_FOR_DELIVERY');

-- View for mechanic performance summary
CREATE OR REPLACE VIEW mechanic_performance_summary AS
SELECT 
  m.id as mechanic_id,
  m.full_name as mechanic_name,
  m.email,
  m.phone,
  
  -- Current day metrics
  mpm.total_jobs_assigned as jobs_today,
  mpm.total_jobs_completed as completed_today,
  mpm.jobs_in_progress,
  mpm.jobs_on_hold,
  
  -- Performance indicators
  mpm.sla_success_rate,
  mpm.avg_repair_duration,
  mpm.performance_score,
  mpm.rework_count,
  
  -- 30-day metrics
  (
    SELECT AVG(performance_score)
    FROM mechanic_performance_metrics
    WHERE mechanic_id = m.id
    AND date >= CURRENT_DATE - INTERVAL '30 days'
  ) as avg_performance_30d,
  
  (
    SELECT SUM(total_jobs_completed)
    FROM mechanic_performance_metrics
    WHERE mechanic_id = m.id
    AND date >= CURRENT_DATE - INTERVAL '30 days'
  ) as total_completed_30d,
  
  mpm.date as metrics_date,
  mpm.updated_at
FROM users_login m
JOIN roles r ON m.role_id = r.id
LEFT JOIN mechanic_performance_metrics mpm ON m.id = mpm.mechanic_id AND mpm.date = CURRENT_DATE
WHERE r.role_code = 'WORKSHOP_MECHANIC';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.mechanic_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_extra_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_actions_log ENABLE ROW LEVEL SECURITY;

-- Mechanic can only see their own jobs
CREATE POLICY mechanic_own_jobs ON public.mechanic_jobs
FOR ALL
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Mechanic can only access their own checklists
CREATE POLICY mechanic_own_checklists ON public.service_checklists
FOR ALL
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Similar policies for other tables
CREATE POLICY mechanic_own_media ON public.mechanic_media
FOR ALL
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'AUDITOR')
  )
);

CREATE POLICY mechanic_own_parts ON public.mechanic_parts_usage
FOR ALL
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

CREATE POLICY mechanic_own_extra_work ON public.mechanic_extra_work_requests
FOR ALL
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

CREATE POLICY mechanic_own_chat ON public.mechanic_chat
FOR ALL
USING (
  sender_id = auth.uid() OR recipient_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

CREATE POLICY mechanic_own_metrics ON public.mechanic_performance_metrics
FOR SELECT
USING (
  mechanic_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.mechanic_jobs IS 'Job assignments and tracking for mechanics';
COMMENT ON TABLE public.service_checklists IS 'Dynamic service checklists based on service type';
COMMENT ON TABLE public.mechanic_media IS 'Before, progress, and after images uploaded by mechanics';
COMMENT ON TABLE public.mechanic_parts_usage IS 'Parts issued, used, and returned tracking';
COMMENT ON TABLE public.mechanic_extra_work_requests IS 'Additional work requests submitted by mechanics';
COMMENT ON TABLE public.mechanic_chat IS 'Communication between mechanic and supervisor/admin';
COMMENT ON TABLE public.mechanic_performance_metrics IS 'KPIs and performance metrics for mechanics';
COMMENT ON TABLE public.mechanic_actions_log IS 'Audit trail of all mechanic actions';

-- ============================================
-- Migration Complete!
-- ============================================

