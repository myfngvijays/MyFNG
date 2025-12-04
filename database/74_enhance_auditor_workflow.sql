-- ============================================
-- 74_enhance_auditor_workflow.sql
-- Complete Auditor Role Functionality Enhancement
-- Adds: Job Card Audits, GPS Tracking, Image Verification, Escalations
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Enhancing Auditor Workflow Schema...';
END $$;

-- ============================================
-- 1. ENHANCE EXISTING AUDITS TABLE FOR JOB CARD AUDITS
-- ============================================

-- Add missing columns to audits table (for lead-based job card audits)
DO $$
BEGIN
  -- Add audit_mode (ON_GROUND vs DIGITAL)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'audit_mode') THEN
    ALTER TABLE audits ADD COLUMN audit_mode VARCHAR(20) DEFAULT 'DIGITAL' CHECK (audit_mode IN ('ON_GROUND', 'DIGITAL'));
    RAISE NOTICE '✅ Added audit_mode column';
  END IF;

  -- Add GPS location for on-ground audits
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'arrival_latitude') THEN
    ALTER TABLE audits ADD COLUMN arrival_latitude NUMERIC(10, 8);
    ALTER TABLE audits ADD COLUMN arrival_longitude NUMERIC(11, 8);
    ALTER TABLE audits ADD COLUMN arrival_time TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✅ Added GPS tracking columns';
  END IF;

  -- Add image verification status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'before_images_verified') THEN
    ALTER TABLE audits ADD COLUMN before_images_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN during_images_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN after_images_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN images_compliance_score NUMERIC(5,2) DEFAULT 0;
    RAISE NOTICE '✅ Added image verification columns';
  END IF;

  -- Add extra charges validation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'extra_charges_validated') THEN
    ALTER TABLE audits ADD COLUMN extra_charges_validated BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN extra_charges_rejected_count INTEGER DEFAULT 0;
    ALTER TABLE audits ADD COLUMN extra_charges_rejection_reasons TEXT[];
    RAISE NOTICE '✅ Added extra charges validation columns';
  END IF;

  -- Add findings and recommendations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'findings') THEN
    ALTER TABLE audits ADD COLUMN findings TEXT;
    ALTER TABLE audits ADD COLUMN issues_severity VARCHAR(20) CHECK (issues_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
    ALTER TABLE audits ADD COLUMN recommendations TEXT;
    ALTER TABLE audits ADD COLUMN re_audit_required BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN workshop_manager_meeting_required BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ Added findings columns';
  END IF;

  -- Add escalation tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'escalated') THEN
    ALTER TABLE audits ADD COLUMN escalated BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN escalation_reason TEXT;
    ALTER TABLE audits ADD COLUMN escalated_to UUID REFERENCES users_login(id);
    ALTER TABLE audits ADD COLUMN escalated_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✅ Added escalation columns';
  END IF;

  -- Add fraud detection
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'fraud_detected') THEN
    ALTER TABLE audits ADD COLUMN fraud_detected BOOLEAN DEFAULT FALSE;
    ALTER TABLE audits ADD COLUMN fraud_type VARCHAR(50);
    ALTER TABLE audits ADD COLUMN fraud_details TEXT;
    RAISE NOTICE '✅ Added fraud detection columns';
  END IF;

  -- Add SLA tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audits' AND column_name = 'sla_deadline') THEN
    ALTER TABLE audits ADD COLUMN sla_deadline TIMESTAMP WITH TIME ZONE;
    ALTER TABLE audits ADD COLUMN sla_status VARCHAR(20) DEFAULT 'ON_TIME' CHECK (sla_status IN ('ON_TIME', 'AT_RISK', 'BREACHED'));
    RAISE NOTICE '✅ Added SLA tracking columns';
  END IF;
END $$;

-- ============================================
-- 2. CREATE AUDIT IMAGE VERIFICATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_image_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  
  -- Image category
  image_category VARCHAR(50) NOT NULL CHECK (image_category IN ('BEFORE', 'DURING', 'AFTER', 'PARTS', 'DAMAGE', 'ODOMETER', 'ENGINE_BAY')),
  
  -- Verification details
  required_images_count INTEGER DEFAULT 0,
  uploaded_images_count INTEGER DEFAULT 0,
  verified_images_count INTEGER DEFAULT 0,
  missing_angles TEXT[],
  fake_images_detected BOOLEAN DEFAULT FALSE,
  fake_images_details TEXT,
  
  -- Timestamp verification
  timestamps_match BOOLEAN DEFAULT FALSE,
  timestamp_discrepancies TEXT,
  
  -- Compliance
  compliance_status VARCHAR(20) DEFAULT 'PENDING' CHECK (compliance_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_CORRECTION')),
  compliance_score NUMERIC(5,2) DEFAULT 0,
  verification_notes TEXT,
  
  -- Verification metadata
  verified_by UUID REFERENCES users_login(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_image_verification_audit_id ON audit_image_verification(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_image_verification_lead_id ON audit_image_verification(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_image_verification_category ON audit_image_verification(image_category);

COMMENT ON TABLE audit_image_verification IS 'Tracks image verification for job card audits';

-- ============================================
-- 3. CREATE AUDIT FINDINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  
  -- Finding details
  finding_type VARCHAR(50) NOT NULL CHECK (finding_type IN ('MISSING_IMAGE', 'FAKE_IMAGE', 'PARTS_MISMATCH', 'EXTRA_CHARGE_FRAUD', 'SERVICE_NOT_DONE', 'DAMAGE_NOT_NOTED', 'CLEANLINESS_ISSUE', 'SAFETY_VIOLATION', 'OTHER')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Evidence
  evidence_photos TEXT[],
  evidence_notes TEXT,
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Re-audit flag
  requires_re_audit BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_id ON audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_findings_resolved ON audit_findings(resolved);

COMMENT ON TABLE audit_findings IS 'Detailed findings and issues identified during audit';

-- ============================================
-- 4. CREATE AUDIT MEDIA TABLE (for audit photos)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  
  -- Media details
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'DOCUMENT')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Categorization
  category VARCHAR(50) NOT NULL CHECK (category IN ('BEFORE', 'DURING', 'AFTER', 'WORKSHOP_FACILITY', 'ISSUES_FOUND', 'FRAUD_EVIDENCE', 'PARTS', 'DAMAGE', 'GENERAL')),
  title VARCHAR(255),
  description TEXT,
  
  -- Location (for on-ground audits)
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Metadata
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES users_login(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_media_files_audit_id ON audit_media_files(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_media_files_category ON audit_media_files(category);

COMMENT ON TABLE audit_media_files IS 'Photos and videos uploaded during audit';

-- ============================================
-- 5. CREATE AUDIT ESCALATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES service_leads(id),
  workshop_id UUID REFERENCES workshops(id),
  
  -- Escalation details
  escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN ('FRAUD', 'MISSING_PARTS', 'VEHICLE_DAMAGE', 'EXTRA_CHARGES_SCAM', 'UNSAFE_PRACTICES', 'REPEATED_ISSUES', 'OTHER')),
  priority VARCHAR(20) DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL')),
  reason TEXT NOT NULL,
  details TEXT,
  
  -- Escalation path¯
  escalated_by UUID NOT NULL REFERENCES users_login(id),
  escalated_to UUID NOT NULL REFERENCES users_login(id),
  escalated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  
  -- Evidence
  evidence_urls TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_escalations_audit_id ON audit_escalations(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_escalations_status ON audit_escalations(status);
CREATE INDEX IF NOT EXISTS idx_audit_escalations_escalated_to ON audit_escalations(escalated_to);

COMMENT ON TABLE audit_escalations IS 'Escalations raised during audits';

-- ============================================
-- 6. CREATE AUDIT CHECKLIST FOR JOB CARD AUDITS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_job_card_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  
  -- Checklist item
  category VARCHAR(50) NOT NULL CHECK (category IN ('BEFORE_IMAGES', 'DURING_IMAGES', 'AFTER_IMAGES', 'PARTS_USED', 'EXTRA_CHARGES', 'BILLING_COMPLIANCE', 'SOP_COMPLIANCE', 'CUSTOMER_INSTRUCTIONS')),
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_CORRECTION')),
  verification_notes TEXT,
  
  -- Scoring
  max_points INTEGER DEFAULT 10,
  points_awarded INTEGER DEFAULT 0,
  is_critical BOOLEAN DEFAULT FALSE,
  is_mandatory BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  checked_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_job_card_checklist_audit_id ON audit_job_card_checklist(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_job_card_checklist_category ON audit_job_card_checklist(category);

COMMENT ON TABLE audit_job_card_checklist IS 'Checklist items for job card (vehicle) audits';

-- ============================================
-- 7. ENHANCE WORKSHOP_AUDITS TABLE
-- ============================================

-- Add GPS tracking for workshop audits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workshop_audits' AND column_name = 'arrival_latitude') THEN
    ALTER TABLE workshop_audits ADD COLUMN arrival_latitude NUMERIC(10, 8);
    ALTER TABLE workshop_audits ADD COLUMN arrival_longitude NUMERIC(11, 8);
    ALTER TABLE workshop_audits ADD COLUMN arrival_time TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✅ Added GPS tracking to workshop_audits';
  END IF;

  -- Add audit mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workshop_audits' AND column_name = 'audit_mode') THEN
    ALTER TABLE workshop_audits ADD COLUMN audit_mode VARCHAR(20) DEFAULT 'ON_GROUND' CHECK (audit_mode IN ('ON_GROUND', 'DIGITAL'));
    RAISE NOTICE '✅ Added audit_mode to workshop_audits';
  END IF;

  -- Add escalation tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workshop_audits' AND column_name = 'escalated') THEN
    ALTER TABLE workshop_audits ADD COLUMN escalated BOOLEAN DEFAULT FALSE;
    ALTER TABLE workshop_audits ADD COLUMN escalation_reason TEXT;
    RAISE NOTICE '✅ Added escalation tracking to workshop_audits';
  END IF;
END $$;

-- ============================================
-- 8. CREATE AUDIT SCORING WEIGHTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_scoring_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_type VARCHAR(50) NOT NULL, -- 'JOB_CARD', 'WORKSHOP_FACILITY', 'SURPRISE'
  
  -- Weight percentages (must sum to 100)
  job_quality_weight NUMERIC(5,2) DEFAULT 40,
  image_compliance_weight NUMERIC(5,2) DEFAULT 20,
  cleanliness_weight NUMERIC(5,2) DEFAULT 10,
  sop_compliance_weight NUMERIC(5,2) DEFAULT 20,
  customer_rating_weight NUMERIC(5,2) DEFAULT 10,
  
  -- Additional weights for workshop audits
  infrastructure_weight NUMERIC(5,2) DEFAULT 0,
  equipment_weight NUMERIC(5,2) DEFAULT 0,
  staff_weight NUMERIC(5,2) DEFAULT 0,
  safety_weight NUMERIC(5,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(audit_type)
);

-- Insert default weights
INSERT INTO audit_scoring_weights (audit_type, job_quality_weight, image_compliance_weight, cleanliness_weight, sop_compliance_weight, customer_rating_weight)
VALUES 
  ('JOB_CARD', 40, 20, 10, 20, 10),
  ('WORKSHOP_FACILITY', 0, 0, 15, 25, 0),
  ('SURPRISE', 50, 20, 10, 15, 5)
ON CONFLICT (audit_type) DO NOTHING;

COMMENT ON TABLE audit_scoring_weights IS 'Scoring weights for different audit types';

-- ============================================
-- 9. CREATE FUNCTIONS
-- ============================================

-- Function to calculate job card audit score
CREATE OR REPLACE FUNCTION calculate_job_card_audit_score(p_audit_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_score NUMERIC := 0;
  v_weights RECORD;
  v_job_quality_score NUMERIC := 0;
  v_image_compliance_score NUMERIC := 0;
  v_cleanliness_score NUMERIC := 0;
  v_sop_compliance_score NUMERIC := 0;
  v_customer_rating_score NUMERIC := 0;
BEGIN
  -- Get weights for job card audits
  SELECT * INTO v_weights FROM audit_scoring_weights WHERE audit_type = 'JOB_CARD' AND is_active = TRUE LIMIT 1;
  
  IF v_weights IS NULL THEN
    -- Use default weights
    v_weights.job_quality_weight := 40;
    v_weights.image_compliance_weight := 20;
    v_weights.cleanliness_weight := 10;
    v_weights.sop_compliance_weight := 20;
    v_weights.customer_rating_weight := 10;
  END IF;
  
  -- Get scores from audit
  SELECT 
    COALESCE(images_compliance_score, 0),
    COALESCE(score, 0) * 20 -- Convert 0-5 scale to 0-100
  INTO v_image_compliance_score, v_job_quality_score
  FROM audits
  WHERE id = p_audit_id;
  
  -- Get checklist compliance score
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE verification_status = 'VERIFIED')::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END
  INTO v_sop_compliance_score
  FROM audit_job_card_checklist
  WHERE audit_id = p_audit_id;
  
  -- Calculate weighted total
  v_total_score := 
    (v_job_quality_score * v_weights.job_quality_weight / 100) +
    (v_image_compliance_score * v_weights.image_compliance_weight / 100) +
    (v_cleanliness_score * v_weights.cleanliness_weight / 100) +
    (v_sop_compliance_score * v_weights.sop_compliance_weight / 100) +
    (v_customer_rating_score * v_weights.customer_rating_weight / 100);
  
  -- Update audit score
  UPDATE audits
  SET score = LEAST(v_total_score / 20, 5) -- Convert back to 0-5 scale
  WHERE id = p_audit_id;
  
  RETURN v_total_score;
END;
$$;

-- Function to check SLA for audits
CREATE OR REPLACE FUNCTION check_audit_sla()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update SLA status for audits
  UPDATE audits
  SET sla_status = CASE
    WHEN sla_deadline IS NULL THEN 'ON_TIME'
    WHEN NOW() > sla_deadline THEN 'BREACHED'
    WHEN NOW() > sla_deadline - INTERVAL '30 minutes' THEN 'AT_RISK'
    ELSE 'ON_TIME'
  END
  WHERE status IN ('PENDING', 'IN_PROGRESS')
    AND sla_deadline IS NOT NULL;
END;
$$;

-- ============================================
-- 10. CREATE TRIGGERS
-- ============================================

-- Trigger to auto-calculate job card audit score
CREATE OR REPLACE FUNCTION trigger_calculate_job_card_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status != NEW.status OR OLD.images_compliance_score != NEW.images_compliance_score) THEN
    IF NEW.status = 'COMPLETED' THEN
      PERFORM calculate_job_card_audit_score(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_job_card_score ON audits;
CREATE TRIGGER trigger_update_job_card_score
AFTER UPDATE ON audits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.images_compliance_score IS DISTINCT FROM NEW.images_compliance_score)
EXECUTE FUNCTION trigger_calculate_job_card_score();

-- ============================================
-- 11. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audits_audit_mode ON audits(audit_mode);
CREATE INDEX IF NOT EXISTS idx_audits_sla_status ON audits(sla_status);
CREATE INDEX IF NOT EXISTS idx_audits_escalated ON audits(escalated);
CREATE INDEX IF NOT EXISTS idx_audits_fraud_detected ON audits(fraud_detected);
CREATE INDEX IF NOT EXISTS idx_audits_lead_id_status ON audits(lead_id, status);

-- ============================================
-- 12. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE audit_image_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_job_card_checklist ENABLE ROW LEVEL SECURITY;

-- Policies for audit_image_verification
DROP POLICY IF EXISTS "Auditors can manage image verification" ON audit_image_verification;
CREATE POLICY "Auditors can manage image verification"
ON audit_image_verification
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('AUDITOR', 'SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR
  EXISTS (
    SELECT 1 FROM audits a
    JOIN users_login u ON u.id = auth.uid()
    WHERE a.id = audit_image_verification.audit_id
    AND a.auditor_id = u.id
  )
);

-- Similar policies for other tables
DROP POLICY IF EXISTS "Auditors can manage findings" ON audit_findings;
CREATE POLICY "Auditors can manage findings"
ON audit_findings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM audits a
    JOIN users_login u ON u.id = auth.uid()
    JOIN roles r ON u.role_id = r.id
    WHERE a.id = audit_findings.audit_id
    AND (
      a.auditor_id = u.id
      OR r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  )
);

DROP POLICY IF EXISTS "Auditors can manage media" ON audit_media_files;
CREATE POLICY "Auditors can manage media"
ON audit_media_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM audits a
    JOIN users_login u ON u.id = auth.uid()
    WHERE a.id = audit_media_files.audit_id
    AND (a.auditor_id = u.id OR uploaded_by = u.id)
  )
  OR
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DROP POLICY IF EXISTS "Auditors can manage escalations" ON audit_escalations;
CREATE POLICY "Auditors can manage escalations"
ON audit_escalations
FOR ALL
TO authenticated
USING (
  escalated_by = auth.uid()
  OR escalated_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

DROP POLICY IF EXISTS "Auditors can manage checklist" ON audit_job_card_checklist;
CREATE POLICY "Auditors can manage checklist"
ON audit_job_card_checklist
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM audits a
    JOIN users_login u ON u.id = auth.uid()
    WHERE a.id = audit_job_card_checklist.audit_id
    AND a.auditor_id = u.id
  )
  OR
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- ============================================
-- COMPLETION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Auditor workflow enhancement complete!';
  RAISE NOTICE '📋 Tables created/enhanced:';
  RAISE NOTICE '   - audit_image_verification';
  RAISE NOTICE '   - audit_findings';
  RAISE NOTICE '   - audit_media_files';
  RAISE NOTICE '   - audit_escalations';
  RAISE NOTICE '   - audit_job_card_checklist';
  RAISE NOTICE '   - audit_scoring_weights';
  RAISE NOTICE '   - Enhanced audits table';
  RAISE NOTICE '   - Enhanced workshop_audits table';
END $$;

