-- ============================================
-- FIX: Add INCOMPLETE status and RLS policies
-- ============================================

-- Add INCOMPLETE status to lead_status enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'INCOMPLETE' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'INCOMPLETE';
        RAISE NOTICE '✅ Added INCOMPLETE status to lead_status enum';
    ELSE
        RAISE NOTICE 'ℹ️  INCOMPLETE status already exists';
    END IF;
END $$;

-- Add VALIDATED status if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'VALIDATED' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VALIDATED';
        RAISE NOTICE '✅ Added VALIDATED status to lead_status enum';
    ELSE
        RAISE NOTICE 'ℹ️  VALIDATED status already exists';
    END IF;
END $$;

-- ============================================
-- FIX: RLS Policies for lead_activities
-- ============================================

DO $$ 
BEGIN
    -- Drop existing policy if any
    DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON lead_activities;
    DROP POLICY IF EXISTS "Allow all operations on lead_activities" ON lead_activities;
    DROP POLICY IF EXISTS "Allow authenticated users full access to lead_activities" ON lead_activities;

    -- Enable RLS
    ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

    -- Create permissive policy for authenticated users
    CREATE POLICY "Allow authenticated users full access to lead_activities"
    ON lead_activities
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    RAISE NOTICE '✅ RLS policy updated for lead_activities';
END $$;

-- ============================================
-- FIX: RLS Policies for lead_status_history
-- ============================================

DO $$ 
BEGIN
    -- Drop existing policy if any
    DROP POLICY IF EXISTS "Allow authenticated users to insert history" ON lead_status_history;
    DROP POLICY IF EXISTS "Allow all operations on lead_status_history" ON lead_status_history;
    DROP POLICY IF EXISTS "Allow authenticated users full access to lead_status_history" ON lead_status_history;

    -- Enable RLS
    ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

    -- Create permissive policy for authenticated users
    CREATE POLICY "Allow authenticated users full access to lead_status_history"
    ON lead_status_history
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    RAISE NOTICE '✅ RLS policy updated for lead_status_history';
END $$;

-- ============================================
-- Verification
-- ============================================

-- Check enum values
DO $$ 
DECLARE
    status_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO status_count
    FROM pg_enum 
    WHERE enumtypid = 'lead_status'::regtype 
    AND enumlabel IN ('INCOMPLETE', 'VALIDATED');
    
    RAISE NOTICE '✅ Found % required status values', status_count;
    RAISE NOTICE '✅ Migration complete!';
END $$;

-- View all status values (uncomment to see)
-- SELECT enumlabel as status_value 
-- FROM pg_enum 
-- WHERE enumtypid = 'lead_status'::regtype 
-- ORDER BY enumsortorder;

-- View RLS policies (uncomment to see)
-- SELECT tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('lead_activities', 'lead_status_history');

