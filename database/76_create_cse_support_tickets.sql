-- ============================================
-- 76_create_cse_support_tickets.sql
-- Create customer_support_tickets table for CSE role
-- This table is specifically for CSE ticket management
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating customer_support_tickets table for CSE...';
END $$;

-- Create customer_support_tickets table (if not exists)
CREATE TABLE IF NOT EXISTS customer_support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users_login(id),
  invoice_id UUID REFERENCES invoices(id),
  
  -- Ticket Details
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  issue_category VARCHAR(50) NOT NULL CHECK (issue_category IN (
    'PICKUP_DELAY',
    'DROP_DELAY',
    'JOB_PROGRESS_INQUIRY',
    'EXTRA_CHARGES_DISPUTE',
    'INVOICE_BILLING_ISSUE',
    'WORKSHOP_MISCOMMUNICATION',
    'SERVICE_QUALITY_COMPLAINT',
    'WRONG_WORK_DONE',
    'CANCELLATION_REQUEST',
    'RESCHEDULE_REQUEST',
    'OTHER'
  )),
  
  severity VARCHAR(50) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL')),
  
  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  customer_expected_resolution TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED')),
  
  -- Assignment
  assigned_to UUID REFERENCES users_login(id), -- CSE or Supervisor/Admin
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID REFERENCES users_login(id),
  
  -- SLA
  sla_time TIMESTAMP WITH TIME ZONE,
  sla_status VARCHAR(50) DEFAULT 'ON_TIME' CHECK (sla_status IN ('ON_TIME', 'AT_RISK', 'BREACHED')),
  
  -- Resolution
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  resolution_action_taken TEXT,
  customer_satisfied BOOLEAN,
  customer_feedback TEXT,
  
  -- Escalation
  escalated BOOLEAN DEFAULT false,
  escalated_to UUID REFERENCES users_login(id), -- Supervisor/Admin/Lead Manager
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  escalation_level VARCHAR(50), -- SUPERVISOR, WORKSHOP_ADMIN, LEAD_MANAGER, SUB_ADMIN, SUPER_ADMIN
  
  -- Follow-up
  follow_up_required BOOLEAN DEFAULT true,
  follow_up_count INTEGER DEFAULT 0,
  last_follow_up_at TIMESTAMP WITH TIME ZONE,
  next_follow_up_at TIMESTAMP WITH TIME ZONE,
  
  -- Attachments
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Internal notes (CSE can add)
  internal_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_login(id), -- CSE who created
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES users_login(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_lead_id ON customer_support_tickets(lead_id);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_customer_id ON customer_support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_status ON customer_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_severity ON customer_support_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_assigned_to ON customer_support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_ticket_number ON customer_support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_issue_category ON customer_support_tickets(issue_category);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_sla_status ON customer_support_tickets(sla_status);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_created_at ON customer_support_tickets(created_at);

-- Create function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('ticket_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for ticket numbers (if not exists)
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Create trigger for ticket number generation
DROP TRIGGER IF EXISTS trigger_generate_ticket_number ON customer_support_tickets;
CREATE TRIGGER trigger_generate_ticket_number
  BEFORE INSERT ON customer_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_number();

-- Enable RLS
ALTER TABLE customer_support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy 1: CSE can view and manage tickets assigned to them or created by them
CREATE POLICY "CSE can manage their tickets"
ON customer_support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND (
      r.role_code = 'CUSTOMER_SERVICE_EXECUTIVE'
      AND (
        customer_support_tickets.assigned_to = u.id
        OR customer_support_tickets.created_by = u.id
      )
    )
    OR r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND (
      r.role_code = 'CUSTOMER_SERVICE_EXECUTIVE'
      AND (
        customer_support_tickets.assigned_to = u.id
        OR customer_support_tickets.created_by = u.id
      )
    )
    OR r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'LEAD_MANAGER')
  )
);

-- Policy 2: Super Admin and Sub Admin can view all tickets
CREATE POLICY "Admins can view all tickets"
ON customer_support_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Add comments
COMMENT ON TABLE customer_support_tickets IS 'Customer support tickets created and managed by CSE';
COMMENT ON COLUMN customer_support_tickets.issue_category IS 'Category of the issue: PICKUP_DELAY, DROP_DELAY, JOB_PROGRESS_INQUIRY, EXTRA_CHARGES_DISPUTE, INVOICE_BILLING_ISSUE, WORKSHOP_MISCOMMUNICATION, SERVICE_QUALITY_COMPLAINT, WRONG_WORK_DONE, CANCELLATION_REQUEST, RESCHEDULE_REQUEST, OTHER';
COMMENT ON COLUMN customer_support_tickets.escalation_level IS 'Level to which ticket was escalated: SUPERVISOR, WORKSHOP_ADMIN, LEAD_MANAGER, SUB_ADMIN, SUPER_ADMIN';

DO $$
BEGIN
  RAISE NOTICE '✅ customer_support_tickets table created successfully!';
  RAISE NOTICE '📋 Features:';
  RAISE NOTICE '   - Ticket number auto-generation';
  RAISE NOTICE '   - Issue category tracking';
  RAISE NOTICE '   - SLA tracking';
  RAISE NOTICE '   - Escalation workflow';
  RAISE NOTICE '   - RLS policies for CSE and Admins';
END $$;

