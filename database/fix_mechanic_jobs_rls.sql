-- RLS Policy for mechanic_jobs table
-- Allow mechanics to update their own jobs

-- First check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'mechanic_jobs';

-- Enable RLS if not enabled
ALTER TABLE mechanic_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Mechanics can view their own jobs" ON mechanic_jobs;
DROP POLICY IF EXISTS "Mechanics can update their own jobs" ON mechanic_jobs;
DROP POLICY IF EXISTS "Mechanics can insert their own jobs" ON mechanic_jobs;

-- Policy 1: Mechanics can SELECT (view) their own jobs
CREATE POLICY "Mechanics can view their own jobs"
ON mechanic_jobs
FOR SELECT
TO authenticated
USING (
  mechanic_id = auth.uid()
);

-- Policy 2: Mechanics can UPDATE their own jobs
CREATE POLICY "Mechanics can update their own jobs"
ON mechanic_jobs
FOR UPDATE
TO authenticated
USING (
  mechanic_id = auth.uid()
)
WITH CHECK (
  mechanic_id = auth.uid()
);

-- Policy 3: Allow admins/supervisors to manage all jobs
CREATE POLICY "Admins can manage all mechanic jobs"
ON mechanic_jobs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_login
    JOIN roles ON users_login.role_id = roles.id
    WHERE users_login.id = auth.uid()
    AND roles.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
  )
);

-- Verify policies were created
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'mechanic_jobs'
ORDER BY policyname;

