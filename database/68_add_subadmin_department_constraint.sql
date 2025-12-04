-- ============================================
-- 68_add_subadmin_department_constraint.sql
-- Add department constraint for SUB_ADMIN role
-- ============================================

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  RAISE NOTICE '🔧 Adding department constraint for SUB_ADMIN role...';
  
  -- First, check for invalid department values
  SELECT COUNT(*) INTO invalid_count
  FROM users_login
  WHERE department IS NOT NULL 
    AND department NOT IN ('CSE', 'TELECALLER', 'AUDITOR');
  
  IF invalid_count > 0 THEN
    RAISE NOTICE '⚠️  Found % rows with invalid department values. Cleaning up...', invalid_count;
    
    -- Set invalid department values to NULL
    UPDATE users_login
    SET department = NULL
    WHERE department IS NOT NULL 
      AND department NOT IN ('CSE', 'TELECALLER', 'AUDITOR');
    
    RAISE NOTICE '✅ Cleaned up % invalid department values', invalid_count;
  END IF;
  
  -- Drop constraint if exists to avoid errors
  ALTER TABLE users_login DROP CONSTRAINT IF EXISTS check_subadmin_department;
  
  -- Add constraint: If department is not NULL, it must be one of the valid values
  -- Note: We can't check role_id in CHECK constraint (no subqueries allowed)
  -- So we'll enforce SUB_ADMIN requirement via trigger instead
  ALTER TABLE users_login 
  ADD CONSTRAINT check_subadmin_department 
  CHECK (
    department IS NULL OR department IN ('CSE', 'TELECALLER', 'AUDITOR')
  );
  
  RAISE NOTICE '✅ Department constraint added successfully!';
END $$;

-- Create index for department queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_department 
ON users_login(department) 
WHERE department IS NOT NULL;

-- Create function to validate SUB_ADMIN has department
CREATE OR REPLACE FUNCTION validate_subadmin_department()
RETURNS TRIGGER AS $$
DECLARE
  role_code_val VARCHAR;
BEGIN
  -- Get role_code for the user
  SELECT r.role_code INTO role_code_val
  FROM roles r
  WHERE r.id = NEW.role_id;
  
  -- If user is SUB_ADMIN, department must be set
  IF role_code_val = 'SUB_ADMIN' THEN
    IF NEW.department IS NULL OR NEW.department NOT IN ('CSE', 'TELECALLER', 'AUDITOR') THEN
      RAISE EXCEPTION 'SUB_ADMIN users must have a valid department (CSE, TELECALLER, or AUDITOR)';
    END IF;
  END IF;
  
  -- If user is not SUB_ADMIN, department should be NULL (but we allow it for flexibility)
  -- No action needed
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_validate_subadmin_department ON users_login;

-- Create trigger
CREATE TRIGGER trigger_validate_subadmin_department
  BEFORE INSERT OR UPDATE ON users_login
  FOR EACH ROW
  EXECUTE FUNCTION validate_subadmin_department();

-- Add comment
COMMENT ON COLUMN users_login.department IS 'Department for SUB_ADMIN role: CSE (Customer Service), TELECALLER (Telecalling Manager), or AUDITOR (Audit Manager). SUB_ADMIN users MUST have a department.';
COMMENT ON FUNCTION validate_subadmin_department() IS 'Trigger function to ensure SUB_ADMIN users have a valid department';

