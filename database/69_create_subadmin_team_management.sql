-- ============================================
-- 69_create_subadmin_team_management.sql
-- Create Sub Admin Team Management Table
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating subadmin_team_assignments table...';
END $$;

-- Team assignment table (Sub Admin -> Team Members)
CREATE TABLE IF NOT EXISTS subadmin_team_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subadmin_id UUID NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users_login(id),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subadmin_id, team_member_id, department)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_subadmin_team_subadmin 
ON subadmin_team_assignments(subadmin_id) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subadmin_team_member 
ON subadmin_team_assignments(team_member_id) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subadmin_team_dept 
ON subadmin_team_assignments(department) 
WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE subadmin_team_assignments IS 'Team assignments for Sub Admins - links Sub Admin to their team members (CSE, Telecaller, or Auditor)';
COMMENT ON COLUMN subadmin_team_assignments.department IS 'Department: CSE, TELECALLER, or AUDITOR';
COMMENT ON COLUMN subadmin_team_assignments.is_active IS 'If FALSE, team member is removed from Sub Admin team';

DO $$
BEGIN
  RAISE NOTICE '✅ subadmin_team_assignments table created successfully!';
END $$;

