-- ============================================
-- Prevent status overwrite after WORK_COMPLETED
-- This trigger prevents any status changes after mechanic completes work
-- ============================================

-- Function to prevent status overwrite after WORK_COMPLETED
CREATE OR REPLACE FUNCTION prevent_status_overwrite_after_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If old status is WORK_COMPLETED or later, prevent downgrading
  IF OLD.status IN ('WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
    -- Only allow status to move forward, not backward
    -- Define allowed forward transitions
    CASE OLD.status
      WHEN 'WORK_COMPLETED' THEN
        -- Can move to QC_PENDING, QC_APPROVED, READY_FOR_BILLING
        IF NEW.status NOT IN ('WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from WORK_COMPLETED to %. Status can only move forward to QC_PENDING, QC_APPROVED, READY_FOR_BILLING, or later stages.', NEW.status;
        END IF;
      WHEN 'QC_PENDING' THEN
        -- Can move to QC_APPROVED, READY_FOR_BILLING, or back to WORK_COMPLETED (if QC rejected)
        IF NEW.status NOT IN ('WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from QC_PENDING to %. Status can only move forward or back to WORK_COMPLETED.', NEW.status;
        END IF;
      WHEN 'QC_APPROVED' THEN
        -- Can move to READY_FOR_BILLING, READY_FOR_DELIVERY, DELIVERED, CLOSED
        IF NEW.status NOT IN ('QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from QC_APPROVED to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'READY_FOR_BILLING' THEN
        -- Can move to READY_FOR_DELIVERY, DELIVERED, CLOSED
        IF NEW.status NOT IN ('READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from READY_FOR_BILLING to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'READY_FOR_DELIVERY' THEN
        -- Can move to DELIVERED, CLOSED
        IF NEW.status NOT IN ('READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from READY_FOR_DELIVERY to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'DELIVERED' THEN
        -- Can move to CLOSED
        IF NEW.status NOT IN ('DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from DELIVERED to %. Status can only move forward to CLOSED.', NEW.status;
        END IF;
      WHEN 'CLOSED' THEN
        -- Cannot change from CLOSED
        RAISE EXCEPTION 'Cannot change status from CLOSED. Lead is already closed.';
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_prevent_status_overwrite_after_completion ON public.service_leads;

-- Create trigger
CREATE TRIGGER trigger_prevent_status_overwrite_after_completion
  BEFORE UPDATE ON public.service_leads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION prevent_status_overwrite_after_completion();

-- Add comment
COMMENT ON FUNCTION prevent_status_overwrite_after_completion() IS 'Prevents status from being downgraded after WORK_COMPLETED. Only allows forward progression through workflow stages.';
COMMENT ON TRIGGER trigger_prevent_status_overwrite_after_completion ON public.service_leads IS 'Prevents status overwrite after mechanic completes work - ensures status can only move forward, not backward';

