-- ============================================
-- 71_create_sla_monitoring.sql
-- Create SLA Monitoring Table for Sub Admins
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating subadmin_sla_monitoring table...';
END $$;

-- SLA monitoring for Sub Admins
CREATE TABLE IF NOT EXISTS subadmin_sla_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  entity_type VARCHAR(50) NOT NULL, -- TICKET, LEAD, AUDIT, FOLLOWUP, CALLBACK
  entity_id UUID NOT NULL,
  sla_type VARCHAR(50) NOT NULL, -- FIRST_RESPONSE, RESOLUTION, FOLLOWUP, AUDIT_COMPLETION, CALLBACK
  sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  sla_status VARCHAR(50) DEFAULT 'ON_TIME' CHECK (sla_status IN ('ON_TIME', 'AT_RISK', 'BREACHED')),
  breached_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  subadmin_notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sla_dept 
ON subadmin_sla_monitoring(department);

CREATE INDEX IF NOT EXISTS idx_sla_status 
ON subadmin_sla_monitoring(sla_status);

CREATE INDEX IF NOT EXISTS idx_sla_deadline 
ON subadmin_sla_monitoring(sla_deadline);

CREATE INDEX IF NOT EXISTS idx_sla_entity 
ON subadmin_sla_monitoring(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sla_notified 
ON subadmin_sla_monitoring(subadmin_notified) 
WHERE subadmin_notified = FALSE;

-- Add comments
COMMENT ON TABLE subadmin_sla_monitoring IS 'SLA monitoring for Sub Admin departments - tracks deadlines and breaches';
COMMENT ON COLUMN subadmin_sla_monitoring.sla_type IS 'SLA types: FIRST_RESPONSE (CSE), RESOLUTION (CSE), FOLLOWUP (Telecaller), AUDIT_COMPLETION (Auditor), CALLBACK (Telecaller)';
COMMENT ON COLUMN subadmin_sla_monitoring.sla_status IS 'ON_TIME, AT_RISK (within 2 hours of deadline), BREACHED';

DO $$
BEGIN
  RAISE NOTICE '✅ subadmin_sla_monitoring table created successfully!';
END $$;

