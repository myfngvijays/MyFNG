-- ============================================
-- 73_add_subadmin_rls_policies.sql
-- Add Row Level Security (RLS) policies for Sub Admin tables
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔒 Adding RLS policies for Sub Admin tables...';
END $$;

-- ============================================
-- 1. SUBADMIN_TEAM_ASSIGNMENTS RLS
-- ============================================

ALTER TABLE subadmin_team_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Sub Admins can view their team assignments" ON subadmin_team_assignments;
DROP POLICY IF EXISTS "Sub Admins can manage their team assignments" ON subadmin_team_assignments;
DROP POLICY IF EXISTS "Super Admins can manage all team assignments" ON subadmin_team_assignments;
DROP POLICY IF EXISTS "Team members can view their assignments" ON subadmin_team_assignments;

-- Policy 1: Super Admin can do everything
CREATE POLICY "Super Admins can manage all team assignments"
ON subadmin_team_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Policy 2: Sub Admin can view and manage their own team assignments
CREATE POLICY "Sub Admins can manage their team assignments"
ON subadmin_team_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = subadmin_team_assignments.department
    AND (
      subadmin_team_assignments.subadmin_id = u.id
      OR subadmin_team_assignments.team_member_id = u.id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = subadmin_team_assignments.department
    AND subadmin_team_assignments.subadmin_id = u.id
  )
);

-- Policy 3: Team members can view their own assignments
CREATE POLICY "Team members can view their assignments"
ON subadmin_team_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    WHERE u.id = auth.uid()
    AND subadmin_team_assignments.team_member_id = u.id
    AND subadmin_team_assignments.is_active = TRUE
  )
);

-- ============================================
-- 2. SUBADMIN_ACTIONS RLS
-- ============================================

ALTER TABLE subadmin_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Sub Admins can view their actions" ON subadmin_actions;
DROP POLICY IF EXISTS "Super Admins can view all actions" ON subadmin_actions;
DROP POLICY IF EXISTS "Sub Admins can insert their actions" ON subadmin_actions;

-- Policy 1: Super Admin can view all actions
CREATE POLICY "Super Admins can view all actions"
ON subadmin_actions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy 2: Sub Admin can view their own department's actions
CREATE POLICY "Sub Admins can view their department actions"
ON subadmin_actions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = subadmin_actions.department
  )
);

-- Policy 3: Sub Admin can insert their own actions
CREATE POLICY "Sub Admins can insert their actions"
ON subadmin_actions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = subadmin_actions.department
    AND subadmin_actions.subadmin_id = u.id
  )
);

-- ============================================
-- 3. SUBADMIN_SLA_MONITORING RLS
-- ============================================

ALTER TABLE subadmin_sla_monitoring ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Sub Admins can view their department SLA" ON subadmin_sla_monitoring;
DROP POLICY IF EXISTS "Super Admins can view all SLA" ON subadmin_sla_monitoring;
DROP POLICY IF EXISTS "Sub Admins can manage their department SLA" ON subadmin_sla_monitoring;

-- Policy 1: Super Admin can view all SLA
CREATE POLICY "Super Admins can view all SLA"
ON subadmin_sla_monitoring
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy 2: Sub Admin can view and manage their department's SLA
CREATE POLICY "Sub Admins can manage their department SLA"
ON subadmin_sla_monitoring
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = subadmin_sla_monitoring.department
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    AND (
      r.role_code = 'SUPER_ADMIN'
      OR (r.role_code = 'SUB_ADMIN' AND u.department = subadmin_sla_monitoring.department)
    )
  )
);

-- ============================================
-- 4. ESCALATIONS RLS
-- ============================================

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Sub Admins can view their department escalations" ON escalations;
DROP POLICY IF EXISTS "Super Admins can view all escalations" ON escalations;
DROP POLICY IF EXISTS "Sub Admins can manage their department escalations" ON escalations;
DROP POLICY IF EXISTS "Users can view escalations they created" ON escalations;
DROP POLICY IF EXISTS "Users can view escalations assigned to them" ON escalations;

-- Policy 1: Super Admin can do everything
CREATE POLICY "Super Admins can manage all escalations"
ON escalations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Policy 2: Sub Admin can view and manage their department's escalations
CREATE POLICY "Sub Admins can manage their department escalations"
ON escalations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code = 'SUB_ADMIN'
    AND u.department = escalations.department
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    AND (
      r.role_code = 'SUPER_ADMIN'
      OR (r.role_code = 'SUB_ADMIN' AND u.department = escalations.department)
    )
  )
);

-- Policy 3: Users can view escalations they created
CREATE POLICY "Users can view escalations they created"
ON escalations
FOR SELECT
TO authenticated
USING (
  escalations.escalated_by = auth.uid()
);

-- Policy 4: Users can view escalations assigned to them
CREATE POLICY "Users can view escalations assigned to them"
ON escalations
FOR SELECT
TO authenticated
USING (
  escalations.escalated_to = auth.uid()
  OR escalations.team_member_id = auth.uid()
);

-- Policy 5: CSE, Telecaller, Auditor can create escalations
CREATE POLICY "Department staff can create escalations"
ON escalations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_login u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND (
      r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
      OR r.role_code IN ('CUSTOMER_SERVICE_EXECUTIVE', 'TELECALLER', 'AUDITOR')
    )
  )
);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON subadmin_team_assignments TO authenticated;
GRANT SELECT, INSERT ON subadmin_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subadmin_sla_monitoring TO authenticated;
GRANT SELECT, INSERT, UPDATE ON escalations TO authenticated;

-- Grant usage on sequences (if any)
-- Note: UUID default uses uuid_generate_v4() function, no sequences needed

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies added successfully for all Sub Admin tables!';
  RAISE NOTICE '📋 Policies created for:';
  RAISE NOTICE '   - subadmin_team_assignments';
  RAISE NOTICE '   - subadmin_actions';
  RAISE NOTICE '   - subadmin_sla_monitoring';
  RAISE NOTICE '   - escalations';
END $$;

