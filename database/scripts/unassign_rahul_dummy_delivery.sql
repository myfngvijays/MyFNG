-- Undo auto delivery assignment on dummy lead L-DUM2609011 (Rahul Dummy).
-- Dummy leads may move status backward so advisor can assign delivery manually.

CREATE OR REPLACE FUNCTION prevent_status_overwrite_after_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.created_from, '') = 'DUMMY_SEED' OR COALESCE(OLD.lead_number, '') LIKE 'L-DUM%' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
    CASE OLD.status
      WHEN 'COMPLETED' THEN
        IF NEW.status NOT IN ('COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from COMPLETED to %. Status can only move forward to QC_PENDING, QC_APPROVED, READY_FOR_BILLING, or later stages.', NEW.status;
        END IF;
      WHEN 'WORK_COMPLETED' THEN
        IF NEW.status NOT IN ('COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from WORK_COMPLETED to %. Status can only move forward to COMPLETED, QC_PENDING, QC_APPROVED, READY_FOR_BILLING, or later stages.', NEW.status;
        END IF;
      WHEN 'QC_PENDING' THEN
        IF NEW.status NOT IN ('COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from QC_PENDING to %. Status can only move forward or back to COMPLETED/WORK_COMPLETED.', NEW.status;
        END IF;
      WHEN 'QC_APPROVED' THEN
        IF NEW.status NOT IN ('QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from QC_APPROVED to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'READY_FOR_BILLING' THEN
        IF NEW.status NOT IN ('READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from READY_FOR_BILLING to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'READY_FOR_DELIVERY' THEN
        IF NEW.status NOT IN ('READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from READY_FOR_DELIVERY to %. Status can only move forward.', NEW.status;
        END IF;
      WHEN 'DELIVERED' THEN
        IF NEW.status NOT IN ('DELIVERED', 'CLOSED') THEN
          RAISE EXCEPTION 'Cannot change status from DELIVERED to %. Status can only move forward to CLOSED.', NEW.status;
        END IF;
      WHEN 'CLOSED' THEN
        RAISE EXCEPTION 'Cannot change status from CLOSED. Lead is already closed.';
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE pickup_tracking
SET
  drop_assigned_to = NULL,
  drop_assigned_at = NULL,
  drop_status = NULL,
  drop_otp = NULL,
  drop_otp_verified_at = NULL,
  drop_completed_time = NULL,
  drop_start_time = NULL,
  drop_out_for_delivery_at = NULL,
  drop_in_transit_at = NULL,
  drop_arrived_at = NULL,
  drop_required = true,
  updated_at = now()
WHERE lead_id = (SELECT id FROM service_leads WHERE lead_number = 'L-DUM2609011' LIMIT 1);

UPDATE service_leads
SET
  status = 'READY_FOR_DELIVERY',
  pickup_status = 'VEHICLE_DROPPED_AT_WORKSHOP',
  updated_at = now()
WHERE lead_number = 'L-DUM2609011';
