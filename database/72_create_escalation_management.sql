-- ============================================
-- 72_create_escalation_management.sql
-- Create Escalation Management Table
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating escalations table...';
END $$;

-- Escalation management
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escalation_number VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  escalation_type VARCHAR(50) NOT NULL, -- CUSTOMER, WORKSHOP, TEAM_MEMBER, SLA_BREACH, QUALITY_FAILURE
  priority VARCHAR(50) DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL')),
  status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED_TO_SUPERADMIN')),
  
  -- Related entities
  lead_id UUID REFERENCES service_leads(id),
  ticket_id UUID, -- Reference to customer_complaints or support_tickets
  audit_id UUID REFERENCES workshop_audits(id),
  customer_id UUID REFERENCES users_login(id),
  workshop_id UUID REFERENCES workshops(id),
  team_member_id UUID REFERENCES users_login(id), -- If escalated from team member
  
  -- Escalation details
  escalated_by UUID REFERENCES users_login(id), -- Who escalated (CSE, Telecaller, Auditor, or Customer)
  escalated_to UUID REFERENCES users_login(id), -- Sub Admin
  escalation_reason TEXT NOT NULL,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(100),
  
  -- Resolution
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  resolution_action TEXT,
  
  -- Escalation to Super Admin
  escalated_to_superadmin BOOLEAN DEFAULT FALSE,
  escalated_to_superadmin_at TIMESTAMP WITH TIME ZONE,
  superadmin_notes TEXT,
  
  -- Follow-up
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_count INTEGER DEFAULT 0,
  last_follow_up_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_escalations_dept 
ON escalations(department);

CREATE INDEX IF NOT EXISTS idx_escalations_status 
ON escalations(status);

CREATE INDEX IF NOT EXISTS idx_escalations_priority 
ON escalations(priority);

CREATE INDEX IF NOT EXISTS idx_escalations_subadmin 
ON escalations(escalated_to) 
WHERE status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_escalations_lead 
ON escalations(lead_id);

CREATE INDEX IF NOT EXISTS idx_escalations_ticket 
ON escalations(ticket_id);

CREATE INDEX IF NOT EXISTS idx_escalations_audit 
ON escalations(audit_id);

CREATE INDEX IF NOT EXISTS idx_escalations_created 
ON escalations(created_at DESC);

-- Function to generate escalation number
CREATE OR REPLACE FUNCTION generate_escalation_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  counter INTEGER;
BEGIN
  -- Format: ESC-YYYYMMDD-XXXXX
  counter := COALESCE(
    (SELECT COUNT(*)::INTEGER FROM escalations 
     WHERE DATE(created_at) = CURRENT_DATE), 0
  ) + 1;
  
  new_number := 'ESC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 5, '0');
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM escalations WHERE escalation_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'ESC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 5, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate escalation number
CREATE OR REPLACE FUNCTION set_escalation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.escalation_number IS NULL OR NEW.escalation_number = '' THEN
    NEW.escalation_number := generate_escalation_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_escalation_number ON escalations;
CREATE TRIGGER trigger_set_escalation_number
  BEFORE INSERT ON escalations
  FOR EACH ROW
  EXECUTE FUNCTION set_escalation_number();

-- Add comments
COMMENT ON TABLE escalations IS 'Escalation management for Sub Admins - tracks escalations from customers, workshops, team members, and SLA breaches';
COMMENT ON COLUMN escalations.escalation_type IS 'CUSTOMER (angry customer), WORKSHOP (dispute), TEAM_MEMBER (agent issue), SLA_BREACH, QUALITY_FAILURE';
COMMENT ON COLUMN escalations.status IS 'OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED_TO_SUPERADMIN';

DO $$
BEGIN
  RAISE NOTICE '✅ escalations table created successfully!';
END $$;

