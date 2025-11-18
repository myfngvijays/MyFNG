-- =====================================================
-- SUPER ADMIN TABLES - Finance & Payout Management
-- =====================================================
-- Created: November 18, 2025
-- Purpose: Tables for workshop payouts, refunds, fraud management, and system settings
-- Tables: 4 new tables + indexes for existing audit_logs
-- =====================================================

-- =====================================================
-- 1. WORKSHOP PAYOUTS TABLE
-- =====================================================
-- Tracks all financial payouts to workshops

CREATE TABLE IF NOT EXISTS public.workshop_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Workshop Reference
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  
  -- Payout Details
  amount DECIMAL(10, 2) NOT NULL,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  
  -- Jobs Included
  total_jobs INTEGER DEFAULT 0,
  job_ids JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED, FAILED
  
  -- Approval Details
  approved_by UUID REFERENCES public.users_login(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Rejection Details
  rejected_by UUID REFERENCES public.users_login(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Payment Details
  payment_method VARCHAR(50), -- BANK_TRANSFER, UPI, CHEQUE, WALLET
  payment_reference VARCHAR(100),
  payment_date TIMESTAMPTZ,
  
  -- Bank Details
  bank_account_number VARCHAR(50),
  bank_ifsc_code VARCHAR(20),
  bank_name VARCHAR(100),
  
  -- Metadata
  calculation_breakdown JSONB, -- Detailed payout calculation
  deductions JSONB, -- Any deductions applied
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT amount_positive CHECK (amount >= 0),
  CONSTRAINT valid_period CHECK (payout_period_end >= payout_period_start),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

-- Indexes for workshop_payouts
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_workshop ON public.workshop_payouts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_status ON public.workshop_payouts(status);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_created ON public.workshop_payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_period ON public.workshop_payouts(payout_period_start, payout_period_end);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_pending ON public.workshop_payouts(status) WHERE status = 'PENDING';

-- Comments
COMMENT ON TABLE public.workshop_payouts IS 'Tracks all financial payouts to workshops for completed services';
COMMENT ON COLUMN public.workshop_payouts.amount IS 'Total payout amount in INR';
COMMENT ON COLUMN public.workshop_payouts.status IS 'Current status of the payout';
COMMENT ON COLUMN public.workshop_payouts.job_ids IS 'Array of service_leads IDs included in this payout';

DO $$ BEGIN RAISE NOTICE '✅ Table created: workshop_payouts'; END $$;

-- =====================================================
-- 2. REFUND REQUESTS TABLE
-- =====================================================
-- Tracks all customer refund requests

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Lead Reference
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users_login(id),
  workshop_id UUID REFERENCES public.workshops(id),
  
  -- Refund Details
  amount DECIMAL(10, 2) NOT NULL,
  original_amount DECIMAL(10, 2) NOT NULL,
  refund_type VARCHAR(20) NOT NULL DEFAULT 'FULL',
  -- FULL, PARTIAL, CANCELLATION, COMPLAINT, QUALITY_ISSUE
  
  -- Request Details
  reason TEXT NOT NULL,
  reason_category VARCHAR(50),
  -- SERVICE_NOT_DELIVERED, POOR_QUALITY, OVERCHARGE, CANCELLATION, OTHER
  customer_remarks TEXT,
  
  -- Evidence
  attachments JSONB DEFAULT '[]'::jsonb,
  complaint_id UUID,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED, FAILED
  
  -- Approval Details
  approved_by UUID REFERENCES public.users_login(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Rejection Details
  rejected_by UUID REFERENCES public.users_login(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Refund Processing
  refund_method VARCHAR(50), -- ORIGINAL_METHOD, BANK_TRANSFER, UPI, WALLET
  refund_reference VARCHAR(100),
  refund_date TIMESTAMPTZ,
  
  -- Financial Impact
  workshop_penalty DECIMAL(10, 2) DEFAULT 0,
  platform_cost DECIMAL(10, 2) DEFAULT 0,
  who_bears_cost VARCHAR(20), -- WORKSHOP, PLATFORM, SHARED
  
  -- Metadata
  notes TEXT,
  internal_remarks TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users_login(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT amount_positive CHECK (amount >= 0),
  CONSTRAINT valid_refund_amount CHECK (amount <= original_amount),
  CONSTRAINT valid_refund_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT valid_refund_type CHECK (refund_type IN ('FULL', 'PARTIAL', 'CANCELLATION', 'COMPLAINT', 'QUALITY_ISSUE'))
);

-- Indexes for refund_requests
CREATE INDEX IF NOT EXISTS idx_refund_requests_lead ON public.refund_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_customer ON public.refund_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_workshop ON public.refund_requests(workshop_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created ON public.refund_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_pending ON public.refund_requests(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_refund_requests_category ON public.refund_requests(reason_category);

-- Comments
COMMENT ON TABLE public.refund_requests IS 'Tracks all customer refund requests and their processing status';
COMMENT ON COLUMN public.refund_requests.amount IS 'Refund amount requested/approved in INR';
COMMENT ON COLUMN public.refund_requests.refund_type IS 'Type of refund: full, partial, or specific reason';
COMMENT ON COLUMN public.refund_requests.who_bears_cost IS 'Who pays for the refund: workshop, platform, or shared';

DO $$ BEGIN RAISE NOTICE '✅ Table created: refund_requests'; END $$;

-- =====================================================
-- 3. FRAUD CASES TABLE
-- =====================================================
-- Tracks fraud detection and investigation

CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Case Details
  case_number VARCHAR(50) UNIQUE NOT NULL,
  case_type VARCHAR(50) NOT NULL,
  -- DUPLICATE_CHARGE, FAKE_CUSTOMER, FAKE_PARTS, BILLING_FRAUD, WORKSHOP_FRAUD, USER_FRAUD
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  -- LOW, MEDIUM, HIGH, CRITICAL
  
  -- Entities Involved
  workshop_id UUID REFERENCES public.workshops(id),
  user_id UUID REFERENCES public.users_login(id),
  lead_id UUID REFERENCES public.service_leads(id),
  
  -- Fraud Details
  fraud_description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  financial_impact DECIMAL(10, 2) DEFAULT 0,
  affected_customers JSONB DEFAULT '[]'::jsonb,
  
  -- Investigation
  status VARCHAR(20) NOT NULL DEFAULT 'REPORTED',
  -- REPORTED, INVESTIGATING, CONFIRMED, FALSE_POSITIVE, RESOLVED, ESCALATED
  
  investigator_id UUID REFERENCES public.users_login(id),
  investigation_notes TEXT,
  investigation_started_at TIMESTAMPTZ,
  investigation_completed_at TIMESTAMPTZ,
  
  -- Actions Taken
  actions_taken JSONB DEFAULT '[]'::jsonb,
  -- [{action: 'WORKSHOP_BLACKLISTED', date: '...', by: '...'}]
  
  penalty_amount DECIMAL(10, 2) DEFAULT 0,
  refund_issued DECIMAL(10, 2) DEFAULT 0,
  
  -- Resolution
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.users_login(id),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  reported_by UUID REFERENCES public.users_login(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT valid_fraud_status CHECK (status IN ('REPORTED', 'INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED'))
);

-- Indexes for fraud_cases
CREATE INDEX IF NOT EXISTS idx_fraud_cases_workshop ON public.fraud_cases(workshop_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_user ON public.fraud_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_lead ON public.fraud_cases(lead_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON public.fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_severity ON public.fraud_cases(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_type ON public.fraud_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_reported ON public.fraud_cases(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_active ON public.fraud_cases(status) WHERE status IN ('REPORTED', 'INVESTIGATING', 'ESCALATED');

-- Comments
COMMENT ON TABLE public.fraud_cases IS 'Tracks fraud detection, investigation, and resolution';
COMMENT ON COLUMN public.fraud_cases.case_number IS 'Unique case identifier for tracking';
COMMENT ON COLUMN public.fraud_cases.severity IS 'Fraud severity level';
COMMENT ON COLUMN public.fraud_cases.actions_taken IS 'JSON array of actions taken during investigation';

DO $$ BEGIN RAISE NOTICE '✅ Table created: fraud_cases'; END $$;

-- =====================================================
-- 4. SYSTEM SETTINGS TABLE
-- =====================================================
-- Stores global system configuration

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Setting Details
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type VARCHAR(20) NOT NULL DEFAULT 'STRING',
  -- STRING, NUMBER, BOOLEAN, JSON, DATE
  
  -- Organization
  category VARCHAR(50) NOT NULL,
  -- SYSTEM, NOTIFICATIONS, SLA, FINANCE, SECURITY, INTEGRATIONS
  
  -- Metadata
  description TEXT,
  default_value TEXT,
  is_editable BOOLEAN DEFAULT true,
  requires_restart BOOLEAN DEFAULT false,
  
  -- Validation
  validation_rules JSONB,
  -- {min: 0, max: 100, pattern: '...'}
  
  -- Audit
  updated_by UUID REFERENCES public.users_login(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_setting_type CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE'))
);

-- Indexes for system_settings
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- Comments
COMMENT ON TABLE public.system_settings IS 'Stores global system configuration and settings';
COMMENT ON COLUMN public.system_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN public.system_settings.is_editable IS 'Whether Super Admin can edit this setting';

DO $$ BEGIN RAISE NOTICE '✅ Table created: system_settings'; END $$;

-- =====================================================
-- 5. SUPER ADMIN ACTION LOGS (Uses existing audit_logs table)
-- =====================================================
-- Note: audit_logs table already exists in the database
-- We'll just add indexes for Super Admin specific queries

-- Add indexes for Super Admin audit queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

DO $$ BEGIN RAISE NOTICE '✅ Audit logs indexes added for Super Admin'; END $$;

-- =====================================================
-- 6. INSERT DEFAULT SYSTEM SETTINGS
-- =====================================================

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value) VALUES
  ('maintenance_mode', 'false', 'BOOLEAN', 'SYSTEM', 'System maintenance mode - only Super Admins can access', 'false'),
  ('auto_lead_assignment', 'true', 'BOOLEAN', 'SYSTEM', 'Automatically assign leads to workshops', 'true'),
  
  ('sms_notifications_enabled', 'true', 'BOOLEAN', 'NOTIFICATIONS', 'Enable SMS notifications', 'true'),
  ('email_notifications_enabled', 'true', 'BOOLEAN', 'NOTIFICATIONS', 'Enable email notifications', 'true'),
  ('push_notifications_enabled', 'true', 'BOOLEAN', 'NOTIFICATIONS', 'Enable push notifications', 'true'),
  
  ('sla_lead_assignment_minutes', '15', 'NUMBER', 'SLA', 'SLA for lead assignment to manager (minutes)', '15'),
  ('sla_workshop_acceptance_minutes', '30', 'NUMBER', 'SLA', 'SLA for workshop to accept lead (minutes)', '30'),
  ('sla_pickup_arrival_minutes', '60', 'NUMBER', 'SLA', 'SLA for pickup boy arrival (minutes)', '60'),
  ('sla_service_completion_minutes', '240', 'NUMBER', 'SLA', 'SLA for service completion (minutes)', '240'),
  
  ('two_factor_auth_required', 'false', 'BOOLEAN', 'SECURITY', 'Require 2FA for all admin accounts', 'false'),
  ('api_access_enabled', 'true', 'BOOLEAN', 'SECURITY', 'Enable external API access', 'true'),
  ('session_timeout_minutes', '60', 'NUMBER', 'SECURITY', 'Session timeout in minutes', '60'),
  
  ('auto_backup_enabled', 'true', 'BOOLEAN', 'SYSTEM', 'Enable automatic daily backups', 'true'),
  ('backup_time', '02:00', 'STRING', 'SYSTEM', 'Daily backup time (HH:MM)', '02:00'),
  
  ('payout_approval_threshold', '50000', 'NUMBER', 'FINANCE', 'Amount above which payout requires Super Admin approval (INR)', '50000'),
  ('refund_auto_approve_threshold', '1000', 'NUMBER', 'FINANCE', 'Amount below which refunds can be auto-approved (INR)', '1000')
ON CONFLICT (setting_key) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ Default system settings inserted'; END $$;

-- =====================================================
-- 7. SAMPLE DATA FOR TESTING
-- =====================================================

-- Sample workshop payout (PENDING)
INSERT INTO public.workshop_payouts (
  workshop_id,
  amount,
  payout_period_start,
  payout_period_end,
  total_jobs,
  status,
  payment_method,
  notes
)
SELECT 
  id,
  75000.00,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  15,
  'PENDING',
  'BANK_TRANSFER',
  'Monthly payout for October 2025'
FROM public.workshops
WHERE is_verified = true
LIMIT 1
ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ Sample workshop payout inserted'; END $$;

-- Sample refund request (PENDING)
INSERT INTO public.refund_requests (
  lead_id,
  amount,
  original_amount,
  refund_type,
  reason,
  reason_category,
  status
)
SELECT 
  id,
  5000.00,
  5000.00,
  'FULL',
  'Service not completed as promised. Poor quality work.',
  'POOR_QUALITY',
  'PENDING'
FROM public.service_leads
WHERE status = 'COMPLETED'
LIMIT 1
ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ Sample refund request inserted'; END $$;

-- Sample fraud case
INSERT INTO public.fraud_cases (
  case_number,
  case_type,
  severity,
  fraud_description,
  status,
  financial_impact
)
VALUES
  ('FRD-2025-001', 'DUPLICATE_CHARGE', 'HIGH', 'Workshop charged customer twice for the same service', 'REPORTED', 8000.00)
ON CONFLICT (case_number) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ Sample fraud case inserted'; END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$ BEGIN 
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SUPER ADMIN TABLES CREATED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  1. workshop_payouts';
  RAISE NOTICE '  2. refund_requests';
  RAISE NOTICE '  3. fraud_cases';
  RAISE NOTICE '  4. system_settings';
  RAISE NOTICE '  (audit_logs already exists - indexes added)';
  RAISE NOTICE '';
  RAISE NOTICE 'Sample Data Inserted:';
  RAISE NOTICE '  - 1 Pending Payout';
  RAISE NOTICE '  - 1 Pending Refund';
  RAISE NOTICE '  - 1 Fraud Case';
  RAISE NOTICE '  - 16 System Settings';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Super Admin database is ready!';
  RAISE NOTICE '========================================';
END $$;

