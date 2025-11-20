-- ================================================================
-- PHASE 6: ENTERPRISE TABLES - ALL MISSING TABLES (FIXED VERSION)
-- Date: November 20, 2025
-- Description: Adds all 42 missing enterprise-level tables
-- Priority: Complete database schema from provided design
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- SECTION 1: AUDIT & LOGGING TABLES (HIGH PRIORITY)
-- ================================================================

-- 1. System-wide audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users_login(id),
    action VARCHAR NOT NULL,
    table_name VARCHAR,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 2. Lead status history
CREATE TABLE IF NOT EXISTS lead_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    old_status VARCHAR,
    new_status VARCHAR NOT NULL,
    changed_by UUID REFERENCES users_login(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    notes TEXT,
    ip_address VARCHAR,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at DESC);

-- 3. Lead activities
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES service_leads(id),
    user_id UUID REFERENCES users_login(id),
    activity_type VARCHAR NOT NULL,
    description TEXT,
    old_status VARCHAR,
    new_status VARCHAR,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- 4. Lead events
CREATE TABLE IF NOT EXISTS lead_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    event_type VARCHAR NOT NULL,
    event_description TEXT,
    event_data JSONB,
    old_status VARCHAR,
    new_status VARCHAR,
    created_by UUID REFERENCES users_login(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON lead_events(event_type);

-- ================================================================
-- SECTION 2: COMPLAINT & FRAUD MANAGEMENT (HIGH PRIORITY)
-- ================================================================

-- 5. Customer complaints
CREATE TABLE IF NOT EXISTS customer_complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_number VARCHAR NOT NULL UNIQUE,
    lead_id UUID REFERENCES service_leads(id),
    customer_id UUID REFERENCES users_login(id),
    workshop_id UUID REFERENCES workshops(id),
    mechanic_id UUID REFERENCES users_login(id),
    pickup_boy_id UUID REFERENCES users_login(id),
    complaint_type VARCHAR NOT NULL,
    complaint_category VARCHAR,
    severity VARCHAR DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    priority VARCHAR DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    description TEXT NOT NULL,
    customer_expected_resolution TEXT,
    attachments JSONB DEFAULT '[]',
    status VARCHAR DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED')),
    assigned_to UUID REFERENCES users_login(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users_login(id),
    resolution TEXT,
    resolution_action_taken TEXT,
    resolved_by UUID REFERENCES users_login(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    customer_satisfied BOOLEAN,
    customer_feedback TEXT,
    refund_requested BOOLEAN DEFAULT FALSE,
    refund_issued BOOLEAN DEFAULT FALSE,
    refund_amount NUMERIC DEFAULT 0,
    refund_reference VARCHAR,
    compensation_provided TEXT,
    escalated_to_level VARCHAR,
    escalated_at TIMESTAMP WITH TIME ZONE,
    workshop_penalized BOOLEAN DEFAULT FALSE,
    penalty_amount NUMERIC DEFAULT 0,
    penalty_reason TEXT,
    follow_up_required BOOLEAN DEFAULT TRUE,
    follow_up_count INTEGER DEFAULT 0,
    last_follow_up_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users_login(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    closure_notes TEXT,
    internal_notes TEXT,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_lead_id ON customer_complaints(lead_id);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_status ON customer_complaints(status);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_workshop_id ON customer_complaints(workshop_id);

-- 6. Fraud cases
CREATE TABLE IF NOT EXISTS fraud_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR NOT NULL UNIQUE,
    case_type VARCHAR NOT NULL,
    severity VARCHAR NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    workshop_id UUID REFERENCES workshops(id),
    user_id UUID REFERENCES users_login(id),
    lead_id UUID REFERENCES service_leads(id),
    fraud_description TEXT NOT NULL,
    evidence JSONB DEFAULT '[]',
    financial_impact NUMERIC DEFAULT 0,
    affected_customers JSONB DEFAULT '[]',
    status VARCHAR NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED')),
    investigator_id UUID REFERENCES users_login(id),
    investigation_notes TEXT,
    investigation_started_at TIMESTAMP WITH TIME ZONE,
    investigation_completed_at TIMESTAMP WITH TIME ZONE,
    actions_taken JSONB DEFAULT '[]',
    penalty_amount NUMERIC DEFAULT 0,
    refund_issued NUMERIC DEFAULT 0,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users_login(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    reported_by UUID REFERENCES users_login(id),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_workshop_id ON fraud_cases(workshop_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_severity ON fraud_cases(severity);

-- ================================================================
-- SECTION 3: FINANCIAL MANAGEMENT (HIGH PRIORITY)
-- ================================================================

-- 7. Refund requests
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    customer_id UUID REFERENCES users_login(id),
    workshop_id UUID REFERENCES workshops(id),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    original_amount NUMERIC NOT NULL,
    refund_type VARCHAR NOT NULL DEFAULT 'FULL' CHECK (refund_type IN ('FULL', 'PARTIAL', 'CANCELLATION', 'COMPLAINT', 'QUALITY_ISSUE')),
    reason TEXT NOT NULL,
    reason_category VARCHAR,
    customer_remarks TEXT,
    attachments JSONB DEFAULT '[]',
    complaint_id UUID REFERENCES customer_complaints(id),
    status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    approved_by UUID REFERENCES users_login(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    rejected_by UUID REFERENCES users_login(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    refund_method VARCHAR,
    refund_reference VARCHAR,
    refund_date TIMESTAMP WITH TIME ZONE,
    workshop_penalty NUMERIC DEFAULT 0,
    platform_cost NUMERIC DEFAULT 0,
    who_bears_cost VARCHAR,
    notes TEXT,
    internal_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users_login(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_lead_id ON refund_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_workshop_id ON refund_requests(workshop_id);

-- 8. Workshop payouts
CREATE TABLE IF NOT EXISTS workshop_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    payout_period_start DATE NOT NULL,
    payout_period_end DATE NOT NULL,
    total_jobs INTEGER DEFAULT 0,
    job_ids JSONB DEFAULT '[]',
    status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    approved_by UUID REFERENCES users_login(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    rejected_by UUID REFERENCES users_login(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    payment_method VARCHAR,
    payment_reference VARCHAR,
    payment_date TIMESTAMP WITH TIME ZONE,
    bank_account_number VARCHAR,
    bank_ifsc_code VARCHAR,
    bank_name VARCHAR,
    calculation_breakdown JSONB,
    deductions JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users_login(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_payouts_workshop_id ON workshop_payouts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_status ON workshop_payouts(status);
CREATE INDEX IF NOT EXISTS idx_workshop_payouts_period ON workshop_payouts(payout_period_start, payout_period_end);

-- ================================================================
-- SECTION 4: PERFORMANCE METRICS (HIGH PRIORITY)
-- ================================================================

-- 9. Telecaller performance metrics
CREATE TABLE IF NOT EXISTS telecaller_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telecaller_id UUID NOT NULL REFERENCES users_login(id),
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    call_duration_total INTEGER DEFAULT 0,
    avg_call_duration NUMERIC,
    leads_created INTEGER DEFAULT 0,
    leads_completed INTEGER DEFAULT 0,
    leads_followed_up INTEGER DEFAULT 0,
    incomplete_leads_converted INTEGER DEFAULT 0,
    call_to_lead_conversion_rate NUMERIC DEFAULT 0,
    follow_up_success_rate NUMERIC DEFAULT 0,
    duplicate_leads_created INTEGER DEFAULT 0,
    missed_follow_ups INTEGER DEFAULT 0,
    customer_complaints INTEGER DEFAULT 0,
    accuracy_score NUMERIC DEFAULT 0,
    customer_rejected INTEGER DEFAULT 0,
    customer_not_responding INTEGER DEFAULT 0,
    wrong_numbers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(telecaller_id, date)
);

CREATE INDEX IF NOT EXISTS idx_telecaller_metrics_telecaller_id ON telecaller_performance_metrics(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_telecaller_metrics_date ON telecaller_performance_metrics(date DESC);

-- 10. CSE performance metrics
CREATE TABLE IF NOT EXISTS cse_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cse_id UUID NOT NULL REFERENCES users_login(id),
    date DATE NOT NULL,
    total_followups_scheduled INTEGER DEFAULT 0,
    total_followups_completed INTEGER DEFAULT 0,
    followups_pending INTEGER DEFAULT 0,
    followups_overdue INTEGER DEFAULT 0,
    avg_call_duration NUMERIC DEFAULT 0,
    total_call_time NUMERIC DEFAULT 0,
    leads_closed INTEGER DEFAULT 0,
    complaints_resolved INTEGER DEFAULT 0,
    escalations_handled INTEGER DEFAULT 0,
    avg_satisfaction_score NUMERIC DEFAULT 0,
    customers_highly_satisfied INTEGER DEFAULT 0,
    customers_dissatisfied INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    issue_resolution_rate NUMERIC DEFAULT 0,
    first_call_resolution_rate NUMERIC DEFAULT 0,
    customer_retention_rate NUMERIC DEFAULT 0,
    upsell_opportunities_identified INTEGER DEFAULT 0,
    refunds_processed INTEGER DEFAULT 0,
    compensation_issued NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cse_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cse_metrics_cse_id ON cse_performance_metrics(cse_id);
CREATE INDEX IF NOT EXISTS idx_cse_metrics_date ON cse_performance_metrics(date DESC);

-- 11. Pickup boy metrics
CREATE TABLE IF NOT EXISTS pickup_boy_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pickup_boy_id UUID NOT NULL REFERENCES users_login(id),
    date DATE NOT NULL,
    total_pickups INTEGER DEFAULT 0,
    completed_pickups INTEGER DEFAULT 0,
    failed_pickups INTEGER DEFAULT 0,
    total_drops INTEGER DEFAULT 0,
    completed_drops INTEGER DEFAULT 0,
    failed_drops INTEGER DEFAULT 0,
    avg_pickup_time NUMERIC,
    avg_drop_time NUMERIC,
    punctuality_score NUMERIC,
    otp_success_rate NUMERIC,
    photo_compliance_rate NUMERIC,
    customer_complaints INTEGER DEFAULT 0,
    distance_traveled NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pickup_boy_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pickup_boy_metrics_pickup_boy_id ON pickup_boy_metrics(pickup_boy_id);
CREATE INDEX IF NOT EXISTS idx_pickup_boy_metrics_date ON pickup_boy_metrics(date DESC);

-- ================================================================
-- SECTION 5: JOB CARDS & PRICING (MEDIUM PRIORITY)
-- ================================================================

-- 12. Job cards
CREATE TABLE IF NOT EXISTS job_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE REFERENCES service_leads(id),
    job_card_number VARCHAR NOT NULL UNIQUE,
    labor_charges NUMERIC DEFAULT 0,
    additional_work TEXT,
    mechanic_notes TEXT,
    created_by UUID REFERENCES users_login(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_cards_lead_id ON job_cards(lead_id);

-- 13. Job card parts
CREATE TABLE IF NOT EXISTS job_card_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
    part_name VARCHAR NOT NULL,
    part_number VARCHAR,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_card_parts_job_card_id ON job_card_parts(job_card_id);

-- 14. Lead pricing items
CREATE TABLE IF NOT EXISTS lead_pricing_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    service_type_id INTEGER,
    subservice_id INTEGER,
    item_name VARCHAR NOT NULL,
    item_description TEXT,
    base_price NUMERIC NOT NULL DEFAULT 0,
    final_price NUMERIC NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    discount_percentage NUMERIC DEFAULT 0,
    tax_percentage NUMERIC DEFAULT 0,
    is_addon BOOLEAN DEFAULT FALSE,
    status VARCHAR DEFAULT 'ACTIVE',
    added_by UUID REFERENCES users_login(id),
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_pricing_items_lead_id ON lead_pricing_items(lead_id);

-- ================================================================
-- SECTION 6: PICKUP & DELIVERY ADVANCED (MEDIUM PRIORITY)
-- ================================================================

-- 15. Pickup delivery tasks
CREATE TABLE IF NOT EXISTS pickup_delivery_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_number VARCHAR NOT NULL UNIQUE,
    task_type VARCHAR NOT NULL CHECK (task_type IN ('PICKUP', 'DELIVERY', 'BOTH')),
    lead_id UUID REFERENCES service_leads(id),
    workshop_id UUID REFERENCES workshops(id),
    customer_name VARCHAR NOT NULL,
    customer_phone VARCHAR NOT NULL,
    customer_email VARCHAR,
    vehicle_number VARCHAR NOT NULL,
    vehicle_make VARCHAR,
    vehicle_model VARCHAR,
    pickup_address TEXT NOT NULL,
    pickup_latitude NUMERIC,
    pickup_longitude NUMERIC,
    delivery_address TEXT,
    delivery_latitude NUMERIC,
    delivery_longitude NUMERIC,
    assigned_to_id UUID REFERENCES users_login(id),
    assigned_by_id UUID REFERENCES users_login(id),
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    customer_instructions TEXT,
    cancellation_reason TEXT,
    created_by_id UUID REFERENCES users_login(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_delivery_tasks_lead_id ON pickup_delivery_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_pickup_delivery_tasks_assigned_to ON pickup_delivery_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_pickup_delivery_tasks_status ON pickup_delivery_tasks(status);

-- 16. Pickup incidents
CREATE TABLE IF NOT EXISTS pickup_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    reported_by UUID NOT NULL REFERENCES users_login(id),
    incident_type VARCHAR NOT NULL CHECK (incident_type IN ('ACCIDENT', 'VEHICLE_DAMAGE', 'CUSTOMER_DISPUTE', 'THEFT', 'BREAKDOWN', 'DELAY', 'OTHER')),
    description TEXT NOT NULL,
    location_address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    severity VARCHAR NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    photo_urls TEXT[],
    status VARCHAR DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
    resolved_by UUID REFERENCES users_login(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    notified_users UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_incidents_lead_id ON pickup_incidents(lead_id);
CREATE INDEX IF NOT EXISTS idx_pickup_incidents_status ON pickup_incidents(status);

-- 17. Pickup location tracking
CREATE TABLE IF NOT EXISTS pickup_location_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    pickup_boy_id UUID NOT NULL REFERENCES users_login(id),
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    accuracy NUMERIC,
    speed NUMERIC,
    heading NUMERIC,
    status VARCHAR NOT NULL,
    battery_level INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_location_tracking_lead_id ON pickup_location_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_pickup_location_tracking_pickup_boy_id ON pickup_location_tracking(pickup_boy_id);
CREATE INDEX IF NOT EXISTS idx_pickup_location_tracking_timestamp ON pickup_location_tracking(timestamp DESC);

-- 18. Pickup OTPs
CREATE TABLE IF NOT EXISTS pickup_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    otp_type VARCHAR NOT NULL CHECK (otp_type IN ('PICKUP', 'DELIVERY')),
    otp_code VARCHAR NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users_login(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resend_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_otps_lead_id ON pickup_otps(lead_id);
CREATE INDEX IF NOT EXISTS idx_pickup_otps_otp_code ON pickup_otps(otp_code);

-- 19. Vehicle condition photos
CREATE TABLE IF NOT EXISTS vehicle_condition_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    photo_type VARCHAR NOT NULL CHECK (photo_type IN ('PICKUP_BEFORE', 'PICKUP_AFTER', 'DELIVERY_BEFORE', 'DELIVERY_AFTER', 'DAMAGE', 'ODOMETER', 'FUEL_GAUGE')),
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    uploaded_by UUID NOT NULL REFERENCES users_login(id),
    odometer_reading INTEGER,
    fuel_level VARCHAR,
    damage_description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_condition_photos_lead_id ON vehicle_condition_photos(lead_id);

-- ================================================================
-- SECTION 7: TELECALLER FEATURES (MEDIUM PRIORITY)
-- ================================================================

-- 20. Telecaller call logs
CREATE TABLE IF NOT EXISTS telecaller_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    telecaller_id UUID NOT NULL REFERENCES users_login(id),
    call_type VARCHAR NOT NULL CHECK (call_type IN ('INBOUND', 'OUTBOUND', 'FOLLOW_UP', 'VERIFICATION')),
    call_status VARCHAR NOT NULL CHECK (call_status IN ('ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED')),
    call_duration INTEGER,
    outcome VARCHAR,
    customer_response TEXT,
    notes TEXT,
    next_action VARCHAR,
    next_action_time TIMESTAMP WITH TIME ZONE,
    phone_number VARCHAR,
    call_recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telecaller_call_logs_lead_id ON telecaller_call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_telecaller_call_logs_telecaller_id ON telecaller_call_logs(telecaller_id);

-- 21. Telecaller follow ups
CREATE TABLE IF NOT EXISTS telecaller_follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    telecaller_id UUID NOT NULL REFERENCES users_login(id),
    follow_up_type VARCHAR NOT NULL CHECK (follow_up_type IN ('INCOMPLETE_LEAD', 'CALLBACK', 'QUOTATION', 'BOOKING', 'PAYMENT', 'FEEDBACK')),
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    priority VARCHAR DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    reason TEXT NOT NULL,
    context_notes TEXT,
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED')),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users_login(id),
    completion_notes TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telecaller_follow_ups_lead_id ON telecaller_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_telecaller_follow_ups_telecaller_id ON telecaller_follow_ups(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_telecaller_follow_ups_scheduled_time ON telecaller_follow_ups(scheduled_time);

-- 22. Telecaller scripts
CREATE TABLE IF NOT EXISTS telecaller_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_type VARCHAR NOT NULL,
    script_title VARCHAR NOT NULL,
    script_content TEXT NOT NULL,
    language VARCHAR DEFAULT 'en',
    category VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telecaller_scripts_script_type ON telecaller_scripts(script_type);

-- ================================================================
-- SECTION 8: WORKSHOP COMPLIANCE & AUDITS (MEDIUM PRIORITY)
-- ================================================================

-- Create ENUM types for workshop audits
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_type') THEN
        CREATE TYPE audit_type AS ENUM ('INITIAL', 'ROUTINE', 'SURPRISE', 'FOLLOW_UP', 'CERTIFICATION', 'COMPLIANCE');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status') THEN
        CREATE TYPE audit_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_grade') THEN
        CREATE TYPE audit_grade AS ENUM ('A', 'B', 'C', 'D', 'F');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
    END IF;
END $$;

-- 23. Workshop audits
CREATE TABLE IF NOT EXISTS workshop_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    auditor_id UUID NOT NULL REFERENCES users_login(id),
    audit_type audit_type NOT NULL,
    audit_status audit_status DEFAULT 'SCHEDULED',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    overall_score NUMERIC DEFAULT 0,
    max_score NUMERIC DEFAULT 100,
    score_percentage NUMERIC DEFAULT 0,
    audit_grade audit_grade,
    infrastructure_score NUMERIC DEFAULT 0,
    equipment_score NUMERIC DEFAULT 0,
    staff_qualification_score NUMERIC DEFAULT 0,
    safety_compliance_score NUMERIC DEFAULT 0,
    customer_service_score NUMERIC DEFAULT 0,
    work_quality_score NUMERIC DEFAULT 0,
    documentation_score NUMERIC DEFAULT 0,
    cleanliness_score NUMERIC DEFAULT 0,
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT,
    critical_issues TEXT[],
    action_items TEXT[],
    license_verified BOOLEAN DEFAULT FALSE,
    insurance_verified BOOLEAN DEFAULT FALSE,
    safety_certifications_verified BOOLEAN DEFAULT FALSE,
    equipment_calibration_verified BOOLEAN DEFAULT FALSE,
    requires_follow_up BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_audit_id UUID REFERENCES workshop_audits(id),
    follow_up_notes TEXT,
    approved_by UUID REFERENCES users_login(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    notes TEXT,
    auditor_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_audits_workshop_id ON workshop_audits(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_audits_auditor_id ON workshop_audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_workshop_audits_scheduled_date ON workshop_audits(scheduled_date);

-- 24. Workshop certifications
CREATE TABLE IF NOT EXISTS workshop_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    certification_type VARCHAR NOT NULL,
    certification_name VARCHAR NOT NULL,
    issuing_authority VARCHAR,
    issue_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT TRUE,
    verification_status verification_status DEFAULT 'PENDING',
    verified_by UUID REFERENCES users_login(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    document_url TEXT,
    document_number VARCHAR,
    renewal_required BOOLEAN DEFAULT FALSE,
    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    renewal_reminder_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_certifications_workshop_id ON workshop_certifications(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_certifications_expiry_date ON workshop_certifications(expiry_date);

-- 25. Workshop compliance history
CREATE TABLE IF NOT EXISTS workshop_compliance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    snapshot_date DATE NOT NULL,
    overall_compliance_score NUMERIC DEFAULT 0,
    audit_grade audit_grade,
    valid_certifications INTEGER DEFAULT 0,
    expired_certifications INTEGER DEFAULT 0,
    pending_certifications INTEGER DEFAULT 0,
    open_action_items INTEGER DEFAULT 0,
    overdue_action_items INTEGER DEFAULT 0,
    compliance_status VARCHAR DEFAULT 'COMPLIANT',
    recorded_by UUID REFERENCES users_login(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_compliance_history_workshop_id ON workshop_compliance_history(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_compliance_history_snapshot_date ON workshop_compliance_history(snapshot_date DESC);

-- 26. Audit checklist items
CREATE TABLE IF NOT EXISTS audit_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES workshop_audits(id) ON DELETE CASCADE,
    category VARCHAR NOT NULL,
    item_name VARCHAR NOT NULL,
    item_description TEXT,
    max_points INTEGER DEFAULT 10,
    points_awarded INTEGER DEFAULT 0,
    status verification_status DEFAULT 'PENDING',
    is_critical BOOLEAN DEFAULT FALSE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    auditor_notes TEXT,
    evidence_photos TEXT[],
    issues_found TEXT,
    checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_checklist_items_audit_id ON audit_checklist_items(audit_id);

-- 27. Audit action items
CREATE TABLE IF NOT EXISTS audit_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES workshop_audits(id),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    action_title VARCHAR NOT NULL,
    action_description TEXT NOT NULL,
    priority VARCHAR DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category VARCHAR,
    assigned_to UUID REFERENCES users_login(id),
    assigned_by UUID NOT NULL REFERENCES users_login(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date DATE,
    is_overdue BOOLEAN DEFAULT FALSE,
    status VARCHAR DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED')),
    completion_date TIMESTAMP WITH TIME ZONE,
    verification_date TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users_login(id),
    completion_notes TEXT,
    evidence_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action_items_audit_id ON audit_action_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_items_workshop_id ON audit_action_items(workshop_id);

-- 28. Audit media
CREATE TABLE IF NOT EXISTS audit_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES workshop_audits(id) ON DELETE CASCADE,
    media_type VARCHAR NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'REPORT')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    category VARCHAR NOT NULL,
    title VARCHAR,
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    uploaded_by UUID NOT NULL REFERENCES users_login(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_media_audit_id ON audit_media(audit_id);

-- 29. Audit templates
CREATE TABLE IF NOT EXISTS audit_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR NOT NULL,
    template_description TEXT,
    audit_type audit_type NOT NULL,
    checklist_items JSONB DEFAULT '[]',
    category_weights JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users_login(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_templates_audit_type ON audit_templates(audit_type);

-- 30. Auditor performance metrics
CREATE TABLE IF NOT EXISTS auditor_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auditor_id UUID NOT NULL REFERENCES users_login(id),
    date DATE NOT NULL,
    audits_scheduled INTEGER DEFAULT 0,
    audits_completed INTEGER DEFAULT 0,
    audits_cancelled INTEGER DEFAULT 0,
    audits_in_progress INTEGER DEFAULT 0,
    avg_audit_duration NUMERIC,
    total_audit_time NUMERIC,
    workshops_passed INTEGER DEFAULT 0,
    workshops_failed INTEGER DEFAULT 0,
    follow_ups_required INTEGER DEFAULT 0,
    critical_issues_identified INTEGER DEFAULT 0,
    action_items_created INTEGER DEFAULT 0,
    action_items_verified INTEGER DEFAULT 0,
    audits_per_day NUMERIC DEFAULT 0,
    completion_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(auditor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_auditor_performance_metrics_auditor_id ON auditor_performance_metrics(auditor_id);
CREATE INDEX IF NOT EXISTS idx_auditor_performance_metrics_date ON auditor_performance_metrics(date DESC);

-- ================================================================
-- SECTION 9: ADDITIONAL TRACKING & MANAGEMENT (LOW PRIORITY)
-- ================================================================

-- 31. Lead media
CREATE TABLE IF NOT EXISTS lead_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    media_type VARCHAR NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'AUDIO')),
    file_url TEXT NOT NULL,
    file_name VARCHAR,
    file_size INTEGER,
    mime_type VARCHAR,
    uploaded_by UUID REFERENCES users_login(id),
    category VARCHAR,
    thumbnail_url TEXT,
    title VARCHAR,
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_media_lead_id ON lead_media(lead_id);

-- 32. Lead updates
CREATE TABLE IF NOT EXISTS lead_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    updated_by UUID NOT NULL REFERENCES users_login(id),
    update_type VARCHAR NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_updates_lead_id ON lead_updates(lead_id);

-- 33. Mechanic assignments
CREATE TABLE IF NOT EXISTS mechanic_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    mechanic_id UUID NOT NULL REFERENCES users_login(id),
    assigned_by UUID NOT NULL REFERENCES users_login(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reassigned_from UUID REFERENCES users_login(id),
    reassignment_reason TEXT,
    assignment_notes TEXT,
    status VARCHAR DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'REASSIGNED')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_lead_id ON mechanic_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_mechanic_id ON mechanic_assignments(mechanic_id);

-- 34. Supervisor actions
CREATE TABLE IF NOT EXISTS supervisor_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    supervisor_id UUID NOT NULL REFERENCES users_login(id),
    action_type VARCHAR NOT NULL,
    action_data JSONB,
    notes TEXT,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_actions_lead_id ON supervisor_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_supervisor_id ON supervisor_actions(supervisor_id);

-- 35. Billing team actions
CREATE TABLE IF NOT EXISTS billing_team_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    invoice_id UUID REFERENCES invoices(id),
    billing_member_id UUID NOT NULL REFERENCES users_login(id),
    action_type VARCHAR NOT NULL,
    action_description TEXT,
    previous_amount NUMERIC,
    new_amount NUMERIC,
    revision_reason TEXT,
    invoice_sent_via VARCHAR,
    recipient_phone VARCHAR,
    recipient_email VARCHAR,
    sent_at TIMESTAMP WITH TIME ZONE,
    customer_viewed BOOLEAN DEFAULT FALSE,
    customer_viewed_at TIMESTAMP WITH TIME ZONE,
    customer_downloaded BOOLEAN DEFAULT FALSE,
    customer_downloaded_at TIMESTAMP WITH TIME ZONE,
    payment_link VARCHAR,
    payment_link_clicked BOOLEAN DEFAULT FALSE,
    payment_link_clicked_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_team_actions_lead_id ON billing_team_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_billing_team_actions_billing_member_id ON billing_team_actions(billing_member_id);

-- 36. QC checks (detailed)
CREATE TABLE IF NOT EXISTS qc_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    supervisor_id UUID NOT NULL REFERENCES users_login(id),
    qc_status VARCHAR DEFAULT 'PENDING' CHECK (qc_status IN ('PENDING', 'PASSED', 'FAILED', 'NEEDS_REWORK')),
    images_verified BOOLEAN DEFAULT FALSE,
    parts_verified BOOLEAN DEFAULT FALSE,
    mechanic_notes_approved BOOLEAN DEFAULT FALSE,
    checklist_data JSONB DEFAULT '{
        "before_images_uploaded": false,
        "progress_images_uploaded": false,
        "after_images_uploaded": false,
        "service_completed_as_requested": false,
        "all_parts_documented": false,
        "no_additional_issues": false,
        "car_cleaned": false,
        "test_drive_completed": false,
        "no_warning_lights": false,
        "documents_ready": false
    }',
    supervisor_notes TEXT,
    failed_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_checks_lead_id ON qc_checks(lead_id);
CREATE INDEX IF NOT EXISTS idx_qc_checks_supervisor_id ON qc_checks(supervisor_id);

-- ================================================================
-- SECTION 10: COMPLIANCE & SETTINGS (LOW PRIORITY)
-- ================================================================

-- 37. Lead sources
CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_code VARCHAR NOT NULL UNIQUE,
    source_name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 38. Data deletion requests (GDPR)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users_login(id),
    email VARCHAR NOT NULL,
    reason TEXT,
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users_login(id)
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);

-- 39. User consents
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users_login(id),
    consent_type VARCHAR NOT NULL,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_text TEXT,
    ip_address VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

-- 40. System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR NOT NULL DEFAULT 'STRING' CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE')),
    category VARCHAR NOT NULL,
    description TEXT,
    default_value TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    requires_restart BOOLEAN DEFAULT FALSE,
    validation_rules JSONB,
    updated_by UUID REFERENCES users_login(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- 41. Audits (simplified version)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id),
    auditor_id UUID REFERENCES users_login(id),
    audit_type VARCHAR DEFAULT 'QUALITY',
    score NUMERIC CHECK (score >= 0 AND score <= 5),
    remarks TEXT,
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    audit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_lead_id ON audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor_id ON audits(auditor_id);

-- 42. Audit checklist (simplified)
CREATE TABLE IF NOT EXISTS audit_checklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    checklist_item VARCHAR NOT NULL,
    checked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_checklist_audit_id ON audit_checklist(audit_id);

-- Simple SELECT to confirm completion
SELECT 'Phase 6 Migration Complete - 42 tables added successfully' AS status;

