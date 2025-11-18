-- ============================================
-- AUDITOR ROLE - COMPLETE FUNCTIONALITY
-- Database schema for workshop audits, quality scoring, and verification
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Audit Status
CREATE TYPE audit_status AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'FOLLOW_UP_REQUIRED'
);

-- Audit Type
CREATE TYPE audit_type AS ENUM (
  'INITIAL_VERIFICATION',
  'PERIODIC_INSPECTION',
  'COMPLAINT_BASED',
  'QUALITY_CHECK',
  'RENEWAL_AUDIT',
  'RANDOM_CHECK',
  'FOLLOW_UP'
);

-- Audit Score Grade
CREATE TYPE audit_grade AS ENUM (
  'A_PLUS',  -- 90-100
  'A',       -- 80-89
  'B',       -- 70-79
  'C',       -- 60-69
  'D',       -- 50-59
  'F'        -- Below 50
);

-- Verification Status
CREATE TYPE verification_status AS ENUM (
  'VERIFIED',
  'REJECTED',
  'PENDING',
  'NEEDS_CORRECTION',
  'APPROVED_WITH_CONDITIONS'
);

-- ============================================
-- TABLES
-- ============================================

-- Workshop Audits
CREATE TABLE public.workshop_audits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  workshop_id uuid NOT NULL,
  auditor_id uuid NOT NULL,
  
  -- Audit details
  audit_type audit_type NOT NULL,
  audit_status audit_status DEFAULT 'SCHEDULED',
  
  -- Scheduling
  scheduled_date date NOT NULL,
  scheduled_time time,
  actual_start_time timestamp with time zone,
  actual_end_time timestamp with time zone,
  duration_minutes integer,
  
  -- Scoring
  overall_score numeric DEFAULT 0,
  max_score numeric DEFAULT 100,
  score_percentage numeric DEFAULT 0,
  audit_grade audit_grade,
  
  -- Category scores (out of 100 each)
  infrastructure_score numeric DEFAULT 0,
  equipment_score numeric DEFAULT 0,
  staff_qualification_score numeric DEFAULT 0,
  safety_compliance_score numeric DEFAULT 0,
  customer_service_score numeric DEFAULT 0,
  work_quality_score numeric DEFAULT 0,
  documentation_score numeric DEFAULT 0,
  cleanliness_score numeric DEFAULT 0,
  
  -- Audit findings
  strengths text,
  weaknesses text,
  recommendations text,
  critical_issues text[],
  action_items text[],
  
  -- Compliance
  license_verified boolean DEFAULT false,
  insurance_verified boolean DEFAULT false,
  safety_certifications_verified boolean DEFAULT false,
  equipment_calibration_verified boolean DEFAULT false,
  
  -- Follow-up
  requires_follow_up boolean DEFAULT false,
  follow_up_date date,
  follow_up_audit_id uuid,
  follow_up_notes text,
  
  -- Approval
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  
  -- Metadata
  notes text,
  auditor_remarks text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT workshop_audits_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_audits_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE,
  CONSTRAINT workshop_audits_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES public.users_login(id),
  CONSTRAINT workshop_audits_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users_login(id),
  CONSTRAINT workshop_audits_follow_up_fkey FOREIGN KEY (follow_up_audit_id) REFERENCES public.workshop_audits(id)
);

-- Audit Checklist Items
CREATE TABLE public.audit_checklist_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  audit_id uuid NOT NULL,
  
  -- Item details
  category varchar NOT NULL, -- 'INFRASTRUCTURE', 'EQUIPMENT', 'STAFF', 'SAFETY', 'CUSTOMER_SERVICE', 'WORK_QUALITY', 'DOCUMENTATION', 'CLEANLINESS'
  item_name varchar NOT NULL,
  item_description text,
  
  -- Scoring
  max_points integer DEFAULT 10,
  points_awarded integer DEFAULT 0,
  
  -- Status
  status verification_status DEFAULT 'PENDING',
  is_critical boolean DEFAULT false,
  is_mandatory boolean DEFAULT true,
  
  -- Findings
  auditor_notes text,
  evidence_photos text[],
  issues_found text,
  
  -- Timestamps
  checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT audit_checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT audit_checklist_items_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.workshop_audits(id) ON DELETE CASCADE
);

-- Audit Media (Photos/Videos)
CREATE TABLE public.audit_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  audit_id uuid NOT NULL,
  
  -- Media details
  media_type varchar NOT NULL, -- 'PHOTO', 'VIDEO', 'DOCUMENT'
  media_url text NOT NULL,
  thumbnail_url text,
  
  -- Categorization
  category varchar NOT NULL, -- Same as checklist categories + 'GENERAL', 'VIOLATION', 'IMPROVEMENT'
  title varchar,
  description text,
  
  -- Location
  latitude numeric,
  longitude numeric,
  
  -- Metadata
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT audit_media_pkey PRIMARY KEY (id),
  CONSTRAINT audit_media_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.workshop_audits(id) ON DELETE CASCADE,
  CONSTRAINT audit_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_login(id)
);

-- Workshop Certifications & Licenses
CREATE TABLE public.workshop_certifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  workshop_id uuid NOT NULL,
  
  -- Certification details
  certification_type varchar NOT NULL, -- 'BUSINESS_LICENSE', 'INSURANCE', 'SAFETY_CERT', 'TRADE_LICENSE', 'ENVIRONMENTAL_CERT', 'EQUIPMENT_CALIBRATION', 'OTHER'
  certification_name varchar NOT NULL,
  issuing_authority varchar,
  
  -- Validity
  issue_date date,
  expiry_date date,
  is_valid boolean DEFAULT true,
  
  -- Verification
  verification_status verification_status DEFAULT 'PENDING',
  verified_by uuid,
  verified_at timestamp with time zone,
  verification_notes text,
  
  -- Documents
  document_url text,
  document_number varchar,
  
  -- Renewal
  renewal_required boolean DEFAULT false,
  renewal_reminder_sent boolean DEFAULT false,
  renewal_reminder_date date,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT workshop_certifications_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_certifications_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE,
  CONSTRAINT workshop_certifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users_login(id)
);

-- Audit Action Items (Follow-ups)
CREATE TABLE public.audit_action_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  audit_id uuid NOT NULL,
  workshop_id uuid NOT NULL,
  
  -- Action details
  action_title varchar NOT NULL,
  action_description text NOT NULL,
  priority varchar DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  category varchar,
  
  -- Assignment
  assigned_to uuid, -- Workshop admin or staff
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  
  -- Deadline
  due_date date,
  is_overdue boolean DEFAULT false,
  
  -- Status
  status varchar DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'VERIFIED'
  completion_date timestamp with time zone,
  verification_date timestamp with time zone,
  verified_by uuid,
  
  -- Evidence
  completion_notes text,
  evidence_urls text[],
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT audit_action_items_pkey PRIMARY KEY (id),
  CONSTRAINT audit_action_items_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.workshop_audits(id) ON DELETE CASCADE,
  CONSTRAINT audit_action_items_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id),
  CONSTRAINT audit_action_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users_login(id),
  CONSTRAINT audit_action_items_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users_login(id),
  CONSTRAINT audit_action_items_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users_login(id)
);

-- Workshop Compliance History
CREATE TABLE public.workshop_compliance_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  workshop_id uuid NOT NULL,
  
  -- Compliance snapshot
  snapshot_date date NOT NULL,
  
  -- Scores
  overall_compliance_score numeric DEFAULT 0,
  audit_grade audit_grade,
  
  -- Certifications
  valid_certifications integer DEFAULT 0,
  expired_certifications integer DEFAULT 0,
  pending_certifications integer DEFAULT 0,
  
  -- Action items
  open_action_items integer DEFAULT 0,
  overdue_action_items integer DEFAULT 0,
  
  -- Status
  compliance_status varchar DEFAULT 'COMPLIANT', -- 'COMPLIANT', 'NON_COMPLIANT', 'AT_RISK', 'SUSPENDED'
  
  -- Metadata
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT workshop_compliance_history_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_compliance_history_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE,
  CONSTRAINT workshop_compliance_history_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users_login(id)
);

-- Auditor Performance Metrics
CREATE TABLE public.auditor_performance_metrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auditor_id uuid NOT NULL,
  date date NOT NULL,
  
  -- Audit counts
  audits_scheduled integer DEFAULT 0,
  audits_completed integer DEFAULT 0,
  audits_cancelled integer DEFAULT 0,
  audits_in_progress integer DEFAULT 0,
  
  -- Timing metrics
  avg_audit_duration numeric, -- in minutes
  total_audit_time numeric, -- in minutes
  
  -- Quality metrics
  workshops_passed integer DEFAULT 0,
  workshops_failed integer DEFAULT 0,
  follow_ups_required integer DEFAULT 0,
  critical_issues_identified integer DEFAULT 0,
  
  -- Action item metrics
  action_items_created integer DEFAULT 0,
  action_items_verified integer DEFAULT 0,
  
  -- Efficiency
  audits_per_day numeric DEFAULT 0,
  completion_rate numeric DEFAULT 0,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT auditor_performance_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT auditor_performance_metrics_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES public.users_login(id),
  CONSTRAINT auditor_performance_metrics_unique_date UNIQUE (auditor_id, date)
);

-- Audit Templates (Reusable checklists)
CREATE TABLE public.audit_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  
  -- Template details
  template_name varchar NOT NULL,
  template_description text,
  audit_type audit_type NOT NULL,
  
  -- Checklist items (JSONB for flexibility)
  checklist_items jsonb DEFAULT '[]'::jsonb,
  -- Format: [
  --   {
  --     "category": "INFRASTRUCTURE",
  --     "item_name": "Parking space availability",
  --     "description": "Adequate parking for customers",
  --     "max_points": 10,
  --     "is_critical": false,
  --     "is_mandatory": true
  --   }
  -- ]
  
  -- Scoring weights
  category_weights jsonb DEFAULT '{}'::jsonb,
  -- Format: {
  --   "INFRASTRUCTURE": 15,
  --   "EQUIPMENT": 20,
  --   "STAFF": 15,
  --   ...
  -- }
  
  -- Status
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  
  -- Metadata
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT audit_templates_pkey PRIMARY KEY (id),
  CONSTRAINT audit_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_login(id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Workshop Audits indexes
CREATE INDEX idx_workshop_audits_workshop_id ON public.workshop_audits(workshop_id);
CREATE INDEX idx_workshop_audits_auditor_id ON public.workshop_audits(auditor_id);
CREATE INDEX idx_workshop_audits_status ON public.workshop_audits(audit_status);
CREATE INDEX idx_workshop_audits_type ON public.workshop_audits(audit_type);
CREATE INDEX idx_workshop_audits_scheduled_date ON public.workshop_audits(scheduled_date);
CREATE INDEX idx_workshop_audits_grade ON public.workshop_audits(audit_grade);

-- Checklist Items indexes
CREATE INDEX idx_audit_checklist_items_audit_id ON public.audit_checklist_items(audit_id);
CREATE INDEX idx_audit_checklist_items_category ON public.audit_checklist_items(category);
CREATE INDEX idx_audit_checklist_items_status ON public.audit_checklist_items(status);

-- Audit Media indexes
CREATE INDEX idx_audit_media_audit_id ON public.audit_media(audit_id);
CREATE INDEX idx_audit_media_category ON public.audit_media(category);

-- Certifications indexes
CREATE INDEX idx_workshop_certifications_workshop_id ON public.workshop_certifications(workshop_id);
CREATE INDEX idx_workshop_certifications_expiry_date ON public.workshop_certifications(expiry_date);
CREATE INDEX idx_workshop_certifications_status ON public.workshop_certifications(verification_status);

-- Action Items indexes
CREATE INDEX idx_audit_action_items_audit_id ON public.audit_action_items(audit_id);
CREATE INDEX idx_audit_action_items_workshop_id ON public.audit_action_items(workshop_id);
CREATE INDEX idx_audit_action_items_status ON public.audit_action_items(status);
CREATE INDEX idx_audit_action_items_due_date ON public.audit_action_items(due_date);
CREATE INDEX idx_audit_action_items_assigned_to ON public.audit_action_items(assigned_to);

-- Compliance History indexes
CREATE INDEX idx_workshop_compliance_history_workshop_id ON public.workshop_compliance_history(workshop_id);
CREATE INDEX idx_workshop_compliance_history_date ON public.workshop_compliance_history(snapshot_date DESC);

-- Auditor Metrics indexes
CREATE INDEX idx_auditor_performance_metrics_auditor_id ON public.auditor_performance_metrics(auditor_id);
CREATE INDEX idx_auditor_performance_metrics_date ON public.auditor_performance_metrics(date DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate audit score
CREATE OR REPLACE FUNCTION calculate_audit_score(p_audit_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_points integer;
  v_max_points integer;
  v_score_percentage numeric;
  v_grade audit_grade;
BEGIN
  -- Calculate total points from checklist
  SELECT 
    COALESCE(SUM(points_awarded), 0),
    COALESCE(SUM(max_points), 100)
  INTO v_total_points, v_max_points
  FROM public.audit_checklist_items
  WHERE audit_id = p_audit_id;
  
  -- Calculate percentage
  IF v_max_points > 0 THEN
    v_score_percentage := (v_total_points::numeric / v_max_points::numeric) * 100;
  ELSE
    v_score_percentage := 0;
  END IF;
  
  -- Determine grade
  IF v_score_percentage >= 90 THEN
    v_grade := 'A_PLUS';
  ELSIF v_score_percentage >= 80 THEN
    v_grade := 'A';
  ELSIF v_score_percentage >= 70 THEN
    v_grade := 'B';
  ELSIF v_score_percentage >= 60 THEN
    v_grade := 'C';
  ELSIF v_score_percentage >= 50 THEN
    v_grade := 'D';
  ELSE
    v_grade := 'F';
  END IF;
  
  -- Update audit
  UPDATE public.workshop_audits
  SET 
    overall_score = v_total_points,
    max_score = v_max_points,
    score_percentage = v_score_percentage,
    audit_grade = v_grade,
    updated_at = NOW()
  WHERE id = p_audit_id;
END;
$$;

-- Function to calculate category scores
CREATE OR REPLACE FUNCTION calculate_category_scores(p_audit_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_category varchar;
  v_score numeric;
BEGIN
  FOR v_category IN 
    SELECT DISTINCT category FROM public.audit_checklist_items WHERE audit_id = p_audit_id
  LOOP
    SELECT 
      CASE 
        WHEN SUM(max_points) > 0 THEN
          (SUM(points_awarded)::numeric / SUM(max_points)::numeric) * 100
        ELSE 0
      END
    INTO v_score
    FROM public.audit_checklist_items
    WHERE audit_id = p_audit_id AND category = v_category;
    
    -- Update respective category score
    CASE v_category
      WHEN 'INFRASTRUCTURE' THEN
        UPDATE public.workshop_audits SET infrastructure_score = v_score WHERE id = p_audit_id;
      WHEN 'EQUIPMENT' THEN
        UPDATE public.workshop_audits SET equipment_score = v_score WHERE id = p_audit_id;
      WHEN 'STAFF' THEN
        UPDATE public.workshop_audits SET staff_qualification_score = v_score WHERE id = p_audit_id;
      WHEN 'SAFETY' THEN
        UPDATE public.workshop_audits SET safety_compliance_score = v_score WHERE id = p_audit_id;
      WHEN 'CUSTOMER_SERVICE' THEN
        UPDATE public.workshop_audits SET customer_service_score = v_score WHERE id = p_audit_id;
      WHEN 'WORK_QUALITY' THEN
        UPDATE public.workshop_audits SET work_quality_score = v_score WHERE id = p_audit_id;
      WHEN 'DOCUMENTATION' THEN
        UPDATE public.workshop_audits SET documentation_score = v_score WHERE id = p_audit_id;
      WHEN 'CLEANLINESS' THEN
        UPDATE public.workshop_audits SET cleanliness_score = v_score WHERE id = p_audit_id;
    END CASE;
  END LOOP;
END;
$$;

-- Function to check expired certifications
CREATE OR REPLACE FUNCTION check_expired_certifications()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark expired certifications
  UPDATE public.workshop_certifications
  SET 
    is_valid = false,
    renewal_required = true
  WHERE expiry_date < CURRENT_DATE
    AND is_valid = true;
    
  -- Set renewal reminders (30 days before expiry)
  UPDATE public.workshop_certifications
  SET renewal_reminder_date = expiry_date - INTERVAL '30 days'
  WHERE expiry_date > CURRENT_DATE
    AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND renewal_reminder_sent = false;
END;
$$;

-- Function to calculate auditor metrics
CREATE OR REPLACE FUNCTION calculate_auditor_metrics(
  p_auditor_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_scheduled integer;
  v_completed integer;
  v_cancelled integer;
  v_in_progress integer;
  v_passed integer;
  v_failed integer;
  v_avg_duration numeric;
BEGIN
  -- Count audits
  SELECT 
    COUNT(*) FILTER (WHERE audit_status = 'SCHEDULED'),
    COUNT(*) FILTER (WHERE audit_status = 'COMPLETED'),
    COUNT(*) FILTER (WHERE audit_status = 'CANCELLED'),
    COUNT(*) FILTER (WHERE audit_status = 'IN_PROGRESS'),
    COUNT(*) FILTER (WHERE audit_status = 'COMPLETED' AND audit_grade IN ('A_PLUS', 'A', 'B')),
    COUNT(*) FILTER (WHERE audit_status = 'COMPLETED' AND audit_grade IN ('D', 'F')),
    AVG(duration_minutes) FILTER (WHERE audit_status = 'COMPLETED')
  INTO 
    v_scheduled, v_completed, v_cancelled, v_in_progress,
    v_passed, v_failed, v_avg_duration
  FROM public.workshop_audits
  WHERE auditor_id = p_auditor_id
    AND DATE(scheduled_date) = p_date;
  
  -- Insert or update metrics
  INSERT INTO public.auditor_performance_metrics (
    auditor_id, date,
    audits_scheduled, audits_completed, audits_cancelled, audits_in_progress,
    workshops_passed, workshops_failed,
    avg_audit_duration,
    audits_per_day,
    completion_rate
  )
  VALUES (
    p_auditor_id, p_date,
    v_scheduled, v_completed, v_cancelled, v_in_progress,
    v_passed, v_failed,
    v_avg_duration,
    v_completed::numeric,
    CASE WHEN v_scheduled > 0 THEN (v_completed::numeric / v_scheduled::numeric) * 100 ELSE 0 END
  )
  ON CONFLICT (auditor_id, date)
  DO UPDATE SET
    audits_scheduled = v_scheduled,
    audits_completed = v_completed,
    audits_cancelled = v_cancelled,
    audits_in_progress = v_in_progress,
    workshops_passed = v_passed,
    workshops_failed = v_failed,
    avg_audit_duration = v_avg_duration,
    audits_per_day = v_completed,
    completion_rate = CASE WHEN v_scheduled > 0 THEN (v_completed::numeric / v_scheduled::numeric) * 100 ELSE 0 END,
    updated_at = NOW();
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-calculate scores when checklist updated
CREATE OR REPLACE FUNCTION trigger_calculate_audit_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_audit_score(NEW.audit_id);
    PERFORM calculate_category_scores(NEW.audit_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_audit_scores
AFTER INSERT OR UPDATE ON public.audit_checklist_items
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_audit_scores();

-- Trigger to update audit duration
CREATE OR REPLACE FUNCTION trigger_update_audit_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.actual_end_time IS NOT NULL AND NEW.actual_start_time IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60.0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_audit_duration
BEFORE UPDATE ON public.workshop_audits
FOR EACH ROW
WHEN (NEW.actual_end_time IS NOT NULL)
EXECUTE FUNCTION trigger_update_audit_duration();

-- Trigger to mark overdue action items
CREATE OR REPLACE FUNCTION trigger_mark_overdue_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('COMPLETED', 'CANCELLED', 'VERIFIED') THEN
    NEW.is_overdue := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_overdue_actions
BEFORE INSERT OR UPDATE ON public.audit_action_items
FOR EACH ROW
EXECUTE FUNCTION trigger_mark_overdue_actions();

-- ============================================
-- VIEWS
-- ============================================

-- View for auditor dashboard
CREATE OR REPLACE VIEW auditor_dashboard AS
SELECT 
  wa.id as audit_id,
  wa.workshop_id,
  w.name as workshop_name,
  w.city,
  w.state,
  wa.auditor_id,
  wa.audit_type,
  wa.audit_status,
  wa.scheduled_date,
  wa.scheduled_time,
  wa.score_percentage,
  wa.audit_grade,
  wa.requires_follow_up,
  
  -- Count related items
  (SELECT COUNT(*) FROM audit_checklist_items WHERE audit_id = wa.id) as total_checklist_items,
  (SELECT COUNT(*) FROM audit_checklist_items WHERE audit_id = wa.id AND status = 'VERIFIED') as completed_items,
  (SELECT COUNT(*) FROM audit_action_items WHERE audit_id = wa.id AND status = 'OPEN') as open_action_items,
  
  wa.created_at,
  wa.updated_at
FROM workshop_audits wa
JOIN workshops w ON wa.workshop_id = w.id
WHERE wa.audit_status != 'CANCELLED';

-- View for workshop compliance status
CREATE OR REPLACE VIEW workshop_compliance_status AS
SELECT 
  w.id as workshop_id,
  w.name as workshop_name,
  w.city,
  w.state,
  
  -- Latest audit info
  (SELECT audit_grade FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_grade,
  (SELECT score_percentage FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_score,
  (SELECT scheduled_date FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as last_audit_date,
  
  -- Certification status
  (SELECT COUNT(*) FROM workshop_certifications WHERE workshop_id = w.id AND is_valid = true) as valid_certifications,
  (SELECT COUNT(*) FROM workshop_certifications WHERE workshop_id = w.id AND expiry_date < CURRENT_DATE) as expired_certifications,
  
  -- Action items
  (SELECT COUNT(*) FROM audit_action_items aai JOIN workshop_audits wa ON aai.audit_id = wa.id WHERE wa.workshop_id = w.id AND aai.status = 'OPEN') as open_action_items,
  (SELECT COUNT(*) FROM audit_action_items aai JOIN workshop_audits wa ON aai.audit_id = wa.id WHERE wa.workshop_id = w.id AND aai.is_overdue = true) as overdue_action_items,
  
  w.is_verified,
  w.audit_score,
  w.created_at
FROM workshops w;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.workshop_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditor_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Auditors can see all audits, workshops can see their own
CREATE POLICY auditor_access_audits ON public.workshop_audits
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_login ul
    JOIN roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'AUDITOR')
  )
  OR
  workshop_id IN (
    SELECT workshop_id FROM users_login WHERE id = auth.uid()
  )
);

-- Similar policies for other tables
CREATE POLICY auditor_access_checklist ON public.audit_checklist_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workshop_audits wa
    JOIN users_login ul ON ul.id = auth.uid()
    JOIN roles r ON ul.role_id = r.id
    WHERE wa.id = audit_checklist_items.audit_id
    AND (r.role_code IN ('SUPER_ADMIN', 'AUDITOR') OR wa.workshop_id = ul.workshop_id)
  )
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.workshop_audits IS 'Workshop audit records with scoring and compliance tracking';
COMMENT ON TABLE public.audit_checklist_items IS 'Detailed checklist items for each audit';
COMMENT ON TABLE public.audit_media IS 'Photos and videos captured during audits';
COMMENT ON TABLE public.workshop_certifications IS 'Workshop licenses, certifications, and compliance documents';
COMMENT ON TABLE public.audit_action_items IS 'Action items and follow-ups from audits';
COMMENT ON TABLE public.workshop_compliance_history IS 'Historical compliance scores and status';
COMMENT ON TABLE public.auditor_performance_metrics IS 'Auditor KPIs and performance tracking';
COMMENT ON TABLE public.audit_templates IS 'Reusable audit checklist templates';

-- ============================================
-- Migration Complete!
-- ============================================

