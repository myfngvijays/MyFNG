-- ============================================
-- SIMPLE FIX: Add Missing Status Values & Fix RLS
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add INCOMPLETE status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'INCOMPLETE' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'INCOMPLETE';
    END IF;
END $$;

-- 2. Add VALIDATED status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'VALIDATED' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VALIDATED';
    END IF;
END $$;

-- 3. Fix RLS for lead_activities
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON lead_activities;
    DROP POLICY IF EXISTS "Allow all operations on lead_activities" ON lead_activities;
    DROP POLICY IF EXISTS "Allow authenticated users full access to lead_activities" ON lead_activities;
    
    ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Allow authenticated users full access to lead_activities"
    ON lead_activities
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
END $$;

-- 4. Fix RLS for lead_status_history
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to insert history" ON lead_status_history;
    DROP POLICY IF EXISTS "Allow all operations on lead_status_history" ON lead_status_history;
    DROP POLICY IF EXISTS "Allow authenticated users full access to lead_status_history" ON lead_status_history;
    
    ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Allow authenticated users full access to lead_status_history"
    ON lead_status_history
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
END $$;

