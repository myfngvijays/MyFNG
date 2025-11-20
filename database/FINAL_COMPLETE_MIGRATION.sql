-- ================================================================
-- 🚀 FINAL COMPLETE MIGRATION - MYFNG LEAD FLOW
-- ================================================================
-- This migration adds ONLY missing columns and tables to your
-- existing database schema to complete the 12-step lead flow.
--
-- ✅ 100% Safe for existing database
-- ✅ Uses IF NOT EXISTS everywhere
-- ✅ Adds missing columns to service_leads
-- ✅ Adds missing ENUM values
-- ✅ Creates missing tables for CSE, complaints, billing
-- ✅ Can be run multiple times without errors
--
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- STEP 1: ADD MISSING ENUM VALUES TO lead_status
-- ================================================================

DO $$ 
BEGIN
    -- Check if lead_status type exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM (
            'NEW', 'INCOMPLETE', 'VALIDATED', 'ASSIGNED_TO_WORKSHOP',
            'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'MECHANIC_WORKING',
            'AWAITING_QC', 'QC_APPROVED', 'QC_FAILED', 'READY_FOR_BILLING',
            'INVOICE_GENERATED', 'PAYMENT_PENDING', 'PAID', 'AWAITING_DELIVERY',
            'COMPLETED', 'CLOSED', 'CANCELLED'
        );
        RAISE NOTICE '✅ Created lead_status ENUM type';
    ELSE
        -- Add missing values to existing ENUM
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VALIDATED' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'VALIDATED';
            RAISE NOTICE '✅ Added VALIDATED status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ASSIGNED_TO_WORKSHOP' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'ASSIGNED_TO_WORKSHOP';
            RAISE NOTICE '✅ Added ASSIGNED_TO_WORKSHOP status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MECHANIC_WORKING' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'MECHANIC_WORKING';
            RAISE NOTICE '✅ Added MECHANIC_WORKING status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_QC' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'AWAITING_QC';
            RAISE NOTICE '✅ Added AWAITING_QC status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_APPROVED' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'QC_APPROVED';
            RAISE NOTICE '✅ Added QC_APPROVED status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_FAILED' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'QC_FAILED';
            RAISE NOTICE '✅ Added QC_FAILED status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'READY_FOR_BILLING' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'READY_FOR_BILLING';
            RAISE NOTICE '✅ Added READY_FOR_BILLING status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INVOICE_GENERATED' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'INVOICE_GENERATED';
            RAISE NOTICE '✅ Added INVOICE_GENERATED status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_DELIVERY' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'AWAITING_DELIVERY';
            RAISE NOTICE '✅ Added AWAITING_DELIVERY status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' AND enumtypid = 'lead_status'::regtype) THEN
            ALTER TYPE lead_status ADD VALUE 'CLOSED';
            RAISE NOTICE '✅ Added CLOSED status';
        END IF;
        
        RAISE NOTICE '✅ All lead_status values updated!';
    END IF;
END $$;

-- ================================================================
-- STEP 2: ADD MISSING COLUMNS TO service_leads TABLE
-- ================================================================

-- Lead Manager Validation Columns
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validation_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS lead_manager_assigned_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS lead_manager_assigned_at TIMESTAMP WITH TIME ZONE;

-- Workshop Assignment Tracking
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_to_workshop_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS workshop_accepted_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_by_workshop_admin_id UUID;

-- Audit Tracking
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS audit_performed_at TIMESTAMP WITH TIME ZONE;

-- Billing Tracking
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP WITH TIME ZONE;

-- CSE (Customer Service Executive) Columns
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_assigned_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_completed BOOLEAN DEFAULT false;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_notes TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_satisfaction_score INT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS final_closure_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_by UUID;

-- Mechanic Work Tracking
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS mechanic_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS mechanic_completed_at TIMESTAMP WITH TIME ZONE;

-- Payment Collection Details
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_collected_by UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ Added all missing columns to service_leads table!';
END $$;

-- ================================================================
-- STEP 3: ADD FOREIGN KEY CONSTRAINTS (Safe with IF NOT EXISTS)
-- ================================================================

DO $$
BEGIN
    -- validated_by_id FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_validated_by_id_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_validated_by_id_fkey 
        FOREIGN KEY (validated_by_id) REFERENCES users_login(id);
    END IF;

    -- lead_manager_assigned_id FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_lead_manager_assigned_id_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_lead_manager_assigned_id_fkey 
        FOREIGN KEY (lead_manager_assigned_id) REFERENCES users_login(id);
    END IF;

    -- workshop_accepted_by FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_workshop_accepted_by_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_workshop_accepted_by_fkey 
        FOREIGN KEY (workshop_accepted_by) REFERENCES users_login(id);
    END IF;

    -- assigned_by_workshop_admin_id FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_assigned_by_workshop_admin_id_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_assigned_by_workshop_admin_id_fkey 
        FOREIGN KEY (assigned_by_workshop_admin_id) REFERENCES users_login(id);
    END IF;

    -- audit_performed_by FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_audit_performed_by_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_audit_performed_by_fkey 
        FOREIGN KEY (audit_performed_by) REFERENCES users_login(id);
    END IF;

    -- invoice_generated_by FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_invoice_generated_by_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_invoice_generated_by_fkey 
        FOREIGN KEY (invoice_generated_by) REFERENCES users_login(id);
    END IF;

    -- cse_assigned_id FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_cse_assigned_id_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_cse_assigned_id_fkey 
        FOREIGN KEY (cse_assigned_id) REFERENCES users_login(id);
    END IF;

    -- closed_by FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_closed_by_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_closed_by_fkey 
        FOREIGN KEY (closed_by) REFERENCES users_login(id);
    END IF;

    -- payment_collected_by FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_leads_payment_collected_by_fkey'
    ) THEN
        ALTER TABLE service_leads 
        ADD CONSTRAINT service_leads_payment_collected_by_fkey 
        FOREIGN KEY (payment_collected_by) REFERENCES users_login(id);
    END IF;

    RAISE NOTICE '✅ Added all foreign key constraints!';
END $$;

-- ================================================================
-- STEP 4: CREATE CSE FOLLOW-UPS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS cse_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
    cse_id UUID NOT NULL REFERENCES users_login(id),
    followup_type VARCHAR NOT NULL,  -- POST_SERVICE, COMPLAINT, SATISFACTION_CHECK, ESCALATION
    scheduled_time TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    customer_response TEXT,
    satisfaction_score INT CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    service_quality_rating INT CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
    workshop_rating INT CHECK (workshop_rating >= 1 AND workshop_rating <= 5),
    pickup_rating INT CHECK (pickup_rating >= 1 AND pickup_rating <= 5),
    price_rating INT CHECK (price_rating >= 1 AND price_rating <= 5),
    issues_reported TEXT,
    issue_category VARCHAR,  -- QUALITY, PRICING, DELAY, BEHAVIOR, OTHER
    resolution_provided TEXT,
    resolution_status VARCHAR DEFAULT 'PENDING',  -- PENDING, RESOLVED, ESCALATED, NO_ACTION_NEEDED
    escalated BOOLEAN DEFAULT false,
    escalated_to UUID REFERENCES users_login(id),
    escalation_reason TEXT,
    escalated_at TIMESTAMP WITH TIME ZONE,
    would_recommend BOOLEAN,
    feedback_text TEXT,
    call_duration INT,  -- in seconds
    call_recording_url TEXT,
    notes TEXT,
    internal_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cse_followups_lead_id ON cse_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_cse_followups_cse_id ON cse_followups(cse_id);
CREATE INDEX IF NOT EXISTS idx_cse_followups_scheduled_time ON cse_followups(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_cse_followups_completed_at ON cse_followups(completed_at);

DO $$ BEGIN
    RAISE NOTICE '✅ Created cse_followups table!';
END $$;

-- ================================================================
-- STEP 5: CREATE CUSTOMER COMPLAINTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS customer_complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_number VARCHAR UNIQUE NOT NULL,
    lead_id UUID REFERENCES service_leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES users_login(id),
    workshop_id UUID REFERENCES workshops(id),
    mechanic_id UUID REFERENCES users_login(id),
    pickup_boy_id UUID REFERENCES users_login(id),
    complaint_type VARCHAR NOT NULL,  -- SERVICE, BILLING, BEHAVIOR, DELAY, DAMAGE, OTHER
    complaint_category VARCHAR,  -- SERVICE_QUALITY, PRICING_DISPUTE, STAFF_BEHAVIOR, DELIVERY_DELAY, VEHICLE_DAMAGE
    severity VARCHAR DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
    priority VARCHAR DEFAULT 'NORMAL',  -- LOW, NORMAL, HIGH, URGENT
    description TEXT NOT NULL,
    customer_expected_resolution TEXT,
    attachments JSONB DEFAULT '[]',  -- Array of image/video URLs
    status VARCHAR DEFAULT 'OPEN',  -- OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED, REJECTED
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
    refund_requested BOOLEAN DEFAULT false,
    refund_issued BOOLEAN DEFAULT false,
    refund_amount NUMERIC DEFAULT 0,
    refund_reference VARCHAR,
    compensation_provided TEXT,
    escalated_to_level VARCHAR,  -- SUPERVISOR, MANAGER, SENIOR_MANAGEMENT, LEGAL
    escalated_at TIMESTAMP WITH TIME ZONE,
    workshop_penalized BOOLEAN DEFAULT false,
    penalty_amount NUMERIC DEFAULT 0,
    penalty_reason TEXT,
    follow_up_required BOOLEAN DEFAULT true,
    follow_up_count INT DEFAULT 0,
    last_follow_up_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users_login(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    closure_notes TEXT,
    internal_notes TEXT,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_customer_complaints_lead_id ON customer_complaints(lead_id);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_customer_id ON customer_complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_workshop_id ON customer_complaints(workshop_id);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_status ON customer_complaints(status);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_severity ON customer_complaints(severity);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_created_at ON customer_complaints(created_at);

DO $$ BEGIN
    RAISE NOTICE '✅ Created customer_complaints table!';
END $$;

-- ================================================================
-- STEP 6: CREATE BILLING TEAM ACTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS billing_team_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    billing_member_id UUID NOT NULL REFERENCES users_login(id),
    action_type VARCHAR NOT NULL,  -- GENERATED, SENT, REVISED, CANCELLED, PAYMENT_RECEIVED, REMINDER_SENT
    action_description TEXT,
    previous_amount NUMERIC,
    new_amount NUMERIC,
    revision_reason TEXT,
    invoice_sent_via VARCHAR,  -- WHATSAPP, SMS, EMAIL, PDF, IN_APP
    recipient_phone VARCHAR,
    recipient_email VARCHAR,
    sent_at TIMESTAMP WITH TIME ZONE,
    customer_viewed BOOLEAN DEFAULT false,
    customer_viewed_at TIMESTAMP WITH TIME ZONE,
    customer_downloaded BOOLEAN DEFAULT false,
    customer_downloaded_at TIMESTAMP WITH TIME ZONE,
    payment_link VARCHAR,
    payment_link_clicked BOOLEAN DEFAULT false,
    payment_link_clicked_at TIMESTAMP WITH TIME ZONE,
    reminder_count INT DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_billing_actions_lead_id ON billing_team_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_billing_actions_invoice_id ON billing_team_actions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_actions_billing_member_id ON billing_team_actions(billing_member_id);
CREATE INDEX IF NOT EXISTS idx_billing_actions_action_type ON billing_team_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_billing_actions_created_at ON billing_team_actions(created_at);

DO $$ BEGIN
    RAISE NOTICE '✅ Created billing_team_actions table!';
END $$;

-- ================================================================
-- STEP 7: CREATE CSE PERFORMANCE METRICS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS cse_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cse_id UUID NOT NULL REFERENCES users_login(id),
    date DATE NOT NULL,
    total_followups_scheduled INT DEFAULT 0,
    total_followups_completed INT DEFAULT 0,
    followups_pending INT DEFAULT 0,
    followups_overdue INT DEFAULT 0,
    avg_call_duration NUMERIC DEFAULT 0,
    total_call_time NUMERIC DEFAULT 0,
    leads_closed INT DEFAULT 0,
    complaints_resolved INT DEFAULT 0,
    escalations_handled INT DEFAULT 0,
    avg_satisfaction_score NUMERIC DEFAULT 0,
    customers_highly_satisfied INT DEFAULT 0,  -- Score 4-5
    customers_dissatisfied INT DEFAULT 0,  -- Score 1-2
    positive_feedback_count INT DEFAULT 0,
    negative_feedback_count INT DEFAULT 0,
    issue_resolution_rate NUMERIC DEFAULT 0,
    first_call_resolution_rate NUMERIC DEFAULT 0,
    customer_retention_rate NUMERIC DEFAULT 0,
    upsell_opportunities_identified INT DEFAULT 0,
    refunds_processed INT DEFAULT 0,
    compensation_issued NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cse_id, date)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_cse_metrics_cse_id ON cse_performance_metrics(cse_id);
CREATE INDEX IF NOT EXISTS idx_cse_metrics_date ON cse_performance_metrics(date);

DO $$ BEGIN
    RAISE NOTICE '✅ Created cse_performance_metrics table!';
END $$;

-- ================================================================
-- STEP 8: ADD MISSING COLUMNS TO invoices TABLE
-- ================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES workshops(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via VARCHAR;  -- WHATSAPP, SMS, EMAIL, PDF
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revised_count INT DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

DO $$ BEGIN
    RAISE NOTICE '✅ Added missing columns to invoices table!';
END $$;

-- ================================================================
-- STEP 9: CREATE LEAD STATUS HISTORY TABLE (For Audit Trail)
-- ================================================================

CREATE TABLE IF NOT EXISTS lead_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_new_status ON lead_status_history(new_status);

DO $$ BEGIN
    RAISE NOTICE '✅ Created lead_status_history table!';
END $$;

-- ================================================================
-- STEP 10: CREATE USEFUL INDEXES FOR PERFORMANCE
-- ================================================================

-- Service leads indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_validated_by ON service_leads(validated_by_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_validated_at ON service_leads(validated_at);
CREATE INDEX IF NOT EXISTS idx_service_leads_lead_manager_assigned ON service_leads(lead_manager_assigned_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_cse_assigned ON service_leads(cse_assigned_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_invoice_generated_at ON service_leads(invoice_generated_at);
CREATE INDEX IF NOT EXISTS idx_service_leads_customer_satisfaction ON service_leads(customer_satisfaction_score);

DO $$ BEGIN
    RAISE NOTICE '✅ Created performance indexes!';
END $$;

-- ================================================================
-- STEP 11: CREATE AUTO-INCREMENT FUNCTIONS FOR COMPLAINT NUMBERS
-- ================================================================

CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.complaint_number := 'CMP-' || LPAD(NEXTVAL('complaint_number_seq')::TEXT, 8, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence
CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START WITH 10000001;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_complaint_number ON customer_complaints;
CREATE TRIGGER trg_generate_complaint_number
    BEFORE INSERT ON customer_complaints
    FOR EACH ROW
    WHEN (NEW.complaint_number IS NULL)
    EXECUTE FUNCTION generate_complaint_number();

DO $$ BEGIN
    RAISE NOTICE '✅ Created complaint number auto-generation!';
END $$;

-- ================================================================
-- STEP 12: CREATE VIEW FOR LEAD FLOW DASHBOARD
-- ================================================================

CREATE OR REPLACE VIEW lead_flow_dashboard AS
SELECT 
    sl.id,
    sl.lead_number,
    sl.status,
    sl.customer_name,
    sl.customer_phone,
    sl.vehicle_number,
    sl.created_at,
    
    -- Lead Manager
    sl.lead_manager_assigned_id,
    lm.full_name as lead_manager_name,
    sl.validated_by_id,
    val.full_name as validated_by_name,
    sl.validated_at,
    
    -- Workshop
    sl.workshop_id,
    w.name as workshop_name,
    sl.assigned_to_workshop_at,
    sl.workshop_accepted_by,
    wa.full_name as workshop_accepted_by_name,
    sl.accepted_at,
    
    -- Mechanic
    sl.assigned_mechanic_id,
    m.full_name as mechanic_name,
    sl.mechanic_started_at,
    sl.mechanic_completed_at,
    
    -- Supervisor
    sl.assigned_supervisor_id,
    sup.full_name as supervisor_name,
    
    -- QC
    sl.qc_status,
    sl.qc_performed_by,
    qc.full_name as qc_performed_by_name,
    sl.qc_performed_at,
    
    -- Auditor
    sl.audit_performed_by,
    aud.full_name as auditor_name,
    sl.audit_performed_at,
    
    -- Billing
    sl.invoice_generated_by,
    bill.full_name as billing_member_name,
    sl.invoice_generated_at,
    sl.invoice_sent_at,
    
    -- Payment
    sl.payment_status,
    sl.payment_mode,
    sl.payment_collected_by,
    pc.full_name as payment_collected_by_name,
    sl.payment_collected_at,
    
    -- CSE
    sl.cse_assigned_id,
    cse.full_name as cse_name,
    sl.cse_assigned_at,
    sl.cse_followup_completed,
    sl.customer_satisfaction_score,
    
    -- Closure
    sl.completed_at,
    sl.closed_by,
    closer.full_name as closed_by_name,
    sl.final_closure_at,
    
    -- SLA
    sl.sla_status,
    sl.sla_expires_at
    
FROM service_leads sl
LEFT JOIN users_login lm ON sl.lead_manager_assigned_id = lm.id
LEFT JOIN users_login val ON sl.validated_by_id = val.id
LEFT JOIN workshops w ON sl.workshop_id = w.id
LEFT JOIN users_login wa ON sl.workshop_accepted_by = wa.id
LEFT JOIN users_login m ON sl.assigned_mechanic_id = m.id
LEFT JOIN users_login sup ON sl.assigned_supervisor_id = sup.id
LEFT JOIN users_login qc ON sl.qc_performed_by = qc.id
LEFT JOIN users_login aud ON sl.audit_performed_by = aud.id
LEFT JOIN users_login bill ON sl.invoice_generated_by = bill.id
LEFT JOIN users_login pc ON sl.payment_collected_by = pc.id
LEFT JOIN users_login cse ON sl.cse_assigned_id = cse.id
LEFT JOIN users_login closer ON sl.closed_by = closer.id;

DO $$ BEGIN
    RAISE NOTICE '✅ Created lead_flow_dashboard view!';
END $$;

-- ================================================================
-- 🎉 MIGRATION COMPLETE!
-- ================================================================

DO $$ 
BEGIN
    RAISE NOTICE '
    ================================================================
    🎉 MIGRATION COMPLETED SUCCESSFULLY!
    ================================================================
    
    ✅ Added 20+ missing columns to service_leads
    ✅ Added 10 new lead status values
    ✅ Created cse_followups table
    ✅ Created customer_complaints table
    ✅ Created billing_team_actions table
    ✅ Created cse_performance_metrics table
    ✅ Created lead_status_history table
    ✅ Added missing columns to invoices table
    ✅ Created all foreign key constraints
    ✅ Created performance indexes
    ✅ Created complaint number auto-generation
    ✅ Created lead_flow_dashboard view
    
    📊 Your database now supports the complete 12-step lead flow!
    
    🚀 NEXT STEPS:
    1. Update TypeScript types in your application
    2. Update API endpoints for Lead Manager validation
    3. Update API endpoints for CSE follow-ups
    4. Update UI for new statuses
    5. Test the complete lead flow
    
    ================================================================
    ';
END $$;

