-- ============================================
-- Add missing columns to service_checklists table
-- ============================================

-- Add all_mandatory_completed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_checklists' 
    AND column_name = 'all_mandatory_completed'
  ) THEN
    ALTER TABLE public.service_checklists 
    ADD COLUMN all_mandatory_completed boolean DEFAULT false;
    
    RAISE NOTICE '✅ Added all_mandatory_completed column to service_checklists table';
  ELSE
    RAISE NOTICE '✅ all_mandatory_completed column already exists';
  END IF;
END $$;

-- Add started_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_checklists' 
    AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.service_checklists 
    ADD COLUMN started_at timestamp with time zone;
    
    RAISE NOTICE '✅ Added started_at column to service_checklists table';
  ELSE
    RAISE NOTICE '✅ started_at column already exists';
  END IF;
END $$;

-- Verify all columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'service_checklists'
ORDER BY ordinal_position;

