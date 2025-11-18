-- =====================================================
-- 09_add_assigned_manager_column.sql
-- Add assigned_manager_id to users_login for Telecaller management
-- =====================================================

DO $$ BEGIN RAISE NOTICE '🔧 Adding assigned_manager_id column to users_login...'; END $$;

-- Add assigned_manager_id column to users_login table
ALTER TABLE public.users_login
ADD COLUMN IF NOT EXISTS assigned_manager_id UUID;

-- Add foreign key constraint
ALTER TABLE public.users_login
ADD CONSTRAINT users_login_assigned_manager_id_fkey 
FOREIGN KEY (assigned_manager_id) 
REFERENCES public.users_login(id) 
ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_login_assigned_manager_id 
ON public.users_login(assigned_manager_id);

-- Add comment to document the column
COMMENT ON COLUMN public.users_login.assigned_manager_id IS 'Team Manager for this user (required for Telecaller role) - FK to users_login';

DO $$ BEGIN RAISE NOTICE '✅ assigned_manager_id column added successfully!'; END $$;
DO $$ BEGIN RAISE NOTICE 'ℹ️  Telecallers can now be assigned to Team Managers (Lead Manager or Super Admin)'; END $$;

