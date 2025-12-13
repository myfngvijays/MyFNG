-- ============================================
-- POST JOB COMPLETION WORKFLOW ALIGNMENT
-- Purpose:
--   Align "mechanic job complete" -> QC -> billing -> invoice -> payment -> delivery -> CSE -> close/archive
--   so QC does NOT skip billing.
--
-- IMPORTANT (Postgres Enum Note):
--   ALTER TYPE ... ADD VALUE cannot run inside a transaction in many Postgres setups.
--   If your SQL runner wraps everything in a transaction, run these ALTER TYPE statements
--   one-by-one manually.
-- ============================================

-- ============================================
-- 1) Ensure lead_status enum has required values
-- ============================================

-- Required by current app code paths
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'READY_FOR_BILLING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'READY_FOR_DELIVERY';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VEHICLE_DROPPED_AT_WORKSHOP';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'MECHANIC_WORKING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PARTIAL_PAYMENT';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'COD_PENDING';

-- ============================================
-- 2) Update supervisor QC trigger to move to READY_FOR_BILLING (not READY_FOR_DELIVERY)
-- ============================================

-- This function is created in database/07_workshop_supervisor_enhancements.sql
-- We override it here to match the post-job workflow.
CREATE OR REPLACE FUNCTION update_lead_qc_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update QC fields in service_leads when qc_checks changes
  IF NEW.qc_status IS DISTINCT FROM OLD.qc_status THEN
    UPDATE public.service_leads
    SET
      qc_status = NEW.qc_status,
      qc_performed_by = NEW.supervisor_id,
      qc_performed_at = NOW(),
      qc_notes = NEW.supervisor_notes,
      updated_at = NOW()
    WHERE id = NEW.lead_id;

    -- If QC passed and mechanic has finished work, move to READY_FOR_BILLING
    IF NEW.qc_status = 'PASSED' THEN
      UPDATE public.service_leads
      SET
        status = 'READY_FOR_BILLING',
        updated_at = NOW()
      WHERE id = NEW.lead_id
        AND status IN ('WORK_COMPLETED', 'QC_PENDING');
    END IF;

    -- If QC failed, send back to IN_PROGRESS for rework
    IF NEW.qc_status = 'FAILED' THEN
      UPDATE public.service_leads
      SET
        status = 'IN_PROGRESS',
        updated_at = NOW()
      WHERE id = NEW.lead_id
        AND status IN ('WORK_COMPLETED', 'QC_PENDING');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3) (Optional) Add helpful index for READY_FOR_BILLING queue
-- ============================================

CREATE INDEX IF NOT EXISTS idx_service_leads_ready_for_billing
  ON public.service_leads(status)
  WHERE status = 'READY_FOR_BILLING';


