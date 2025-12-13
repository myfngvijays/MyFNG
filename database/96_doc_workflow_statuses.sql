-- ============================================
-- DOC WORKFLOW STATUS ALIGNMENT (User Spec)
-- Purpose:
--   Add doc-named statuses and align QC failed -> REWORK_REQUIRED
--
-- NOTE:
--   ALTER TYPE ... ADD VALUE cannot run inside a transaction in many Postgres setups.
--   If your SQL runner wraps everything in a transaction, run these ALTER TYPE statements
--   one-by-one manually.
-- ============================================

-- 1) Ensure lead_status enum includes doc terms
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'REWORK_REQUIRED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'DELIVERED_TO_CUSTOMER';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'COMPLAINT_OPENED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CUSTOMER_UNHAPPY';
-- COMPLETED already exists in most schemas; keep for safety
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'COMPLETED';

-- 2) Align QC trigger to doc naming (FAILED -> REWORK_REQUIRED)
CREATE OR REPLACE FUNCTION update_lead_qc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qc_status IS DISTINCT FROM OLD.qc_status THEN
    UPDATE public.service_leads
    SET
      qc_status = NEW.qc_status,
      qc_performed_by = NEW.supervisor_id,
      qc_performed_at = NOW(),
      qc_notes = NEW.supervisor_notes,
      updated_at = NOW()
    WHERE id = NEW.lead_id;

    IF NEW.qc_status = 'PASSED' THEN
      UPDATE public.service_leads
      SET
        status = 'READY_FOR_BILLING',
        updated_at = NOW()
      WHERE id = NEW.lead_id
        AND status IN ('WORK_COMPLETED', 'QC_PENDING');
    END IF;

    IF NEW.qc_status = 'FAILED' THEN
      UPDATE public.service_leads
      SET
        status = 'REWORK_REQUIRED',
        updated_at = NOW()
      WHERE id = NEW.lead_id
        AND status IN ('WORK_COMPLETED', 'QC_PENDING');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


