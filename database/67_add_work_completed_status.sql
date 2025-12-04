-- Add WORK_COMPLETED status to lead_status enum
-- Purpose: When mechanic completes work, status should be WORK_COMPLETED (or QC_PENDING if supervisor assigned)

DO $$ 
BEGIN
    -- Check if WORK_COMPLETED status exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'WORK_COMPLETED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'WORK_COMPLETED';
        RAISE NOTICE '✅ Added WORK_COMPLETED status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ WORK_COMPLETED status already exists in lead_status enum';
    END IF;

    -- Check if QC_PENDING status exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'QC_PENDING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'QC_PENDING';
        RAISE NOTICE '✅ Added QC_PENDING status to lead_status enum';
    ELSE
        RAISE NOTICE '✅ QC_PENDING status already exists in lead_status enum';
    END IF;
END $$;

