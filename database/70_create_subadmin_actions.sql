-- ============================================
-- 70_create_subadmin_actions.sql
-- Create Sub Admin Actions Log Table
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating subadmin_actions table...';
END $$;

-- Sub Admin actions log
CREATE TABLE IF NOT EXISTS subadmin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subadmin_id UUID NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  action_type VARCHAR(100) NOT NULL, -- ASSIGN, REASSIGN, ESCALATE, APPROVE_REFUND, APPROVE_AUDIT, REJECT_AUDIT, CORRECT_LEAD, etc.
  action_description TEXT,
  related_entity_type VARCHAR(50), -- LEAD, TICKET, AUDIT, REFUND, COMPLAINT, FOLLOWUP
  related_entity_id UUID,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_subadmin_actions_subadmin 
ON subadmin_actions(subadmin_id);

CREATE INDEX IF NOT EXISTS idx_subadmin_actions_dept 
ON subadmin_actions(department);

CREATE INDEX IF NOT EXISTS idx_subadmin_actions_entity 
ON subadmin_actions(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_subadmin_actions_type 
ON subadmin_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_subadmin_actions_created 
ON subadmin_actions(created_at DESC);

-- Add comments
COMMENT ON TABLE subadmin_actions IS 'Log of all actions performed by Sub Admins for audit trail';
COMMENT ON COLUMN subadmin_actions.action_type IS 'Action types: ASSIGN, REASSIGN, ESCALATE, APPROVE_REFUND, APPROVE_AUDIT, REJECT_AUDIT, CORRECT_LEAD, MERGE_TICKET, etc.';
COMMENT ON COLUMN subadmin_actions.related_entity_type IS 'Entity type: LEAD, TICKET (customer_complaints/support_tickets), AUDIT (workshop_audits), REFUND, COMPLAINT, FOLLOWUP';

DO $$
BEGIN
  RAISE NOTICE '✅ subadmin_actions table created successfully!';
END $$;

