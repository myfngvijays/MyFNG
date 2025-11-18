-- ============================================
-- Workshop Supervisor Enhancements - Migration
-- Phase 1: Core Supervisor Features - Database Schema
-- Task: WS-101
-- ============================================
-- IMPORTANT: Run 07a_supervisor_enum_prerequisites.sql FIRST!
-- That file adds the necessary enum values which must be committed
-- before they can be used in this file.
-- ============================================

-- ============================================
-- 1. Create QC (Quality Control) Checks Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.qc_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users_login(id),
  qc_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PASSED, FAILED
  
  -- Checklist verification flags
  images_verified BOOLEAN DEFAULT false,
  parts_verified BOOLEAN DEFAULT false,
  mechanic_notes_approved BOOLEAN DEFAULT false,
  
  -- Detailed checklist (10 items stored as JSONB)
  checklist_data JSONB DEFAULT '{
    "before_images_uploaded": false,
    "progress_images_uploaded": false,
    "after_images_uploaded": false,
    "all_parts_documented": false,
    "service_completed_as_requested": false,
    "no_additional_issues": false,
    "car_cleaned": false,
    "test_drive_completed": false,
    "no_warning_lights": false,
    "documents_ready": false
  }'::jsonb,
  
  -- Notes and feedback
  supervisor_notes TEXT,
  failed_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.qc_checks IS 'Quality control checks performed by supervisors on completed jobs';

-- ============================================
-- 2. Create Mechanic Assignments Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.mechanic_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES public.users_login(id),
  assigned_by UUID NOT NULL REFERENCES public.users_login(id), -- supervisor_id
  
  -- Assignment tracking
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reassigned_from UUID REFERENCES public.users_login(id), -- previous mechanic (if reassignment)
  reassignment_reason TEXT,
  assignment_notes TEXT,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, REASSIGNED, COMPLETED, CANCELLED
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.mechanic_assignments IS 'Track mechanic assignments and reassignments by supervisors';

-- ============================================
-- 3. Create Supervisor Actions Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.supervisor_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users_login(id),
  
  -- Action details
  action_type VARCHAR(50) NOT NULL, 
  -- Types: ASSIGN_MECHANIC, REASSIGN_MECHANIC, APPROVE_EXTRA_WORK, REJECT_EXTRA_WORK,
  --        QC_PASS, QC_FAIL, MARK_READY_FOR_DELIVERY, ADD_NOTE, APPROVE_IMAGES,
  --        REQUEST_MORE_IMAGES, MOVE_TO_HOLD, ESCALATE
  
  action_data JSONB, -- Additional data specific to the action
  notes TEXT,
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.supervisor_actions IS 'Audit log of all actions performed by supervisors';

-- ============================================
-- 4. Enhance service_leads table
-- ============================================

-- Add QC related columns
ALTER TABLE public.service_leads 
  ADD COLUMN IF NOT EXISTS qc_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS qc_performed_by UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS qc_performed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS qc_notes TEXT,
  
  -- Ready for delivery tracking
  ADD COLUMN IF NOT EXISTS ready_for_delivery_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS marked_ready_by UUID REFERENCES public.users_login(id);

-- Add comments
COMMENT ON COLUMN public.service_leads.qc_status IS 'Quality control status: PENDING, PASSED, FAILED';
COMMENT ON COLUMN public.service_leads.qc_performed_by IS 'Supervisor who performed QC';
COMMENT ON COLUMN public.service_leads.marked_ready_by IS 'Supervisor who marked ready for delivery';

-- ============================================
-- 5. Enhance lead_extra_charges table
-- ============================================

-- Add supervisor approval tracking
ALTER TABLE public.lead_extra_charges
  ADD COLUMN IF NOT EXISTS supervisor_approved_by UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS supervisor_approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approval_responded_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN public.lead_extra_charges.supervisor_approved_by IS 'Supervisor who approved/rejected the extra charge';
COMMENT ON COLUMN public.lead_extra_charges.approval_responded_at IS 'When supervisor responded to approval request';

-- ============================================
-- 6. Create indexes for performance
-- ============================================

-- QC Checks indexes
CREATE INDEX IF NOT EXISTS idx_qc_checks_lead_id ON public.qc_checks(lead_id);
CREATE INDEX IF NOT EXISTS idx_qc_checks_supervisor_id ON public.qc_checks(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_qc_checks_status ON public.qc_checks(qc_status);
CREATE INDEX IF NOT EXISTS idx_qc_checks_created_at ON public.qc_checks(created_at DESC);

-- Mechanic Assignments indexes
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_lead_id ON public.mechanic_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_mechanic_id ON public.mechanic_assignments(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_assigned_by ON public.mechanic_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_status ON public.mechanic_assignments(status);
CREATE INDEX IF NOT EXISTS idx_mechanic_assignments_assigned_at ON public.mechanic_assignments(assigned_at DESC);

-- Supervisor Actions indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_lead_id ON public.supervisor_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_supervisor_id ON public.supervisor_actions(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_action_type ON public.supervisor_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_created_at ON public.supervisor_actions(created_at DESC);

-- Enhanced service_leads indexes for supervisor queries
CREATE INDEX IF NOT EXISTS idx_service_leads_qc_status ON public.service_leads(qc_status);
CREATE INDEX IF NOT EXISTS idx_service_leads_qc_performed_by ON public.service_leads(qc_performed_by);
CREATE INDEX IF NOT EXISTS idx_service_leads_marked_ready_by ON public.service_leads(marked_ready_by);

-- Enhanced lead_extra_charges indexes
CREATE INDEX IF NOT EXISTS idx_lead_extra_charges_supervisor_approved ON public.lead_extra_charges(supervisor_approved_by);

-- ============================================
-- 7. Create function to automatically update QC status in leads
-- ============================================

CREATE OR REPLACE FUNCTION update_lead_qc_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the service_leads table when QC is performed
  IF NEW.qc_status IS DISTINCT FROM OLD.qc_status THEN
    UPDATE public.service_leads
    SET 
      qc_status = NEW.qc_status,
      qc_performed_by = NEW.supervisor_id,
      qc_performed_at = NOW(),
      qc_notes = NEW.supervisor_notes
    WHERE id = NEW.lead_id;
    
    -- If QC passed, allow marking as ready for delivery
    IF NEW.qc_status = 'PASSED' THEN
      -- Automatically change status to READY_FOR_DELIVERY if current status is COMPLETED
      UPDATE public.service_leads
      SET 
        status = 'READY_FOR_DELIVERY',
        ready_for_delivery_at = NOW(),
        marked_ready_by = NEW.supervisor_id
      WHERE id = NEW.lead_id AND status = 'COMPLETED';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for QC status updates
DROP TRIGGER IF EXISTS trigger_update_lead_qc_status ON public.qc_checks;
CREATE TRIGGER trigger_update_lead_qc_status
  AFTER INSERT OR UPDATE ON public.qc_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_qc_status();

-- ============================================
-- 8. Create function to log supervisor actions automatically
-- ============================================

CREATE OR REPLACE FUNCTION log_supervisor_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Log mechanic assignment
  IF TG_TABLE_NAME = 'mechanic_assignments' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.supervisor_actions (
      lead_id,
      supervisor_id,
      action_type,
      action_data,
      notes
    ) VALUES (
      NEW.lead_id,
      NEW.assigned_by,
      CASE 
        WHEN NEW.reassigned_from IS NOT NULL THEN 'REASSIGN_MECHANIC'
        ELSE 'ASSIGN_MECHANIC'
      END,
      jsonb_build_object(
        'mechanic_id', NEW.mechanic_id,
        'reassigned_from', NEW.reassigned_from,
        'assignment_notes', NEW.assignment_notes
      ),
      NEW.reassignment_reason
    );
  END IF;
  
  -- Log QC action
  IF TG_TABLE_NAME = 'qc_checks' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.supervisor_actions (
      lead_id,
      supervisor_id,
      action_type,
      action_data,
      notes
    ) VALUES (
      NEW.lead_id,
      NEW.supervisor_id,
      CASE 
        WHEN NEW.qc_status = 'PASSED' THEN 'QC_PASS'
        WHEN NEW.qc_status = 'FAILED' THEN 'QC_FAIL'
        ELSE 'QC_PENDING'
      END,
      jsonb_build_object(
        'qc_status', NEW.qc_status,
        'checklist_data', NEW.checklist_data
      ),
      NEW.supervisor_notes
    );
  END IF;
  
  -- Log extra work approval/rejection
  IF TG_TABLE_NAME = 'lead_extra_charges' AND TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.supervisor_approved_by IS NOT NULL THEN
      INSERT INTO public.supervisor_actions (
        lead_id,
        supervisor_id,
        action_type,
        action_data,
        notes
      ) VALUES (
        NEW.lead_id,
        NEW.supervisor_approved_by,
        CASE 
          WHEN NEW.status = 'APPROVED' THEN 'APPROVE_EXTRA_WORK'
          WHEN NEW.status = 'REJECTED' THEN 'REJECT_EXTRA_WORK'
          ELSE 'REVIEW_EXTRA_WORK'
        END,
        jsonb_build_object(
          'charge_id', NEW.id,
          'amount', NEW.amount,
          'description', NEW.description
        ),
        NEW.supervisor_approval_notes
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-logging
DROP TRIGGER IF EXISTS trigger_log_mechanic_assignment ON public.mechanic_assignments;
CREATE TRIGGER trigger_log_mechanic_assignment
  AFTER INSERT ON public.mechanic_assignments
  FOR EACH ROW
  EXECUTE FUNCTION log_supervisor_action();

DROP TRIGGER IF EXISTS trigger_log_qc_check ON public.qc_checks;
CREATE TRIGGER trigger_log_qc_check
  AFTER INSERT ON public.qc_checks
  FOR EACH ROW
  EXECUTE FUNCTION log_supervisor_action();

DROP TRIGGER IF EXISTS trigger_log_extra_work_approval ON public.lead_extra_charges;
CREATE TRIGGER trigger_log_extra_work_approval
  AFTER UPDATE ON public.lead_extra_charges
  FOR EACH ROW
  EXECUTE FUNCTION log_supervisor_action();

-- ============================================
-- 9. Create view for supervisor dashboard metrics
-- ============================================

CREATE OR REPLACE VIEW supervisor_dashboard_metrics AS
SELECT 
  sl.workshop_id,
  COUNT(*) FILTER (WHERE sl.created_at::date = CURRENT_DATE) as total_jobs_today,
  COUNT(*) FILTER (WHERE sl.status = 'ASSIGNED') as assigned_jobs,
  COUNT(*) FILTER (WHERE sl.status = 'IN_PROGRESS') as in_progress_jobs,
  COUNT(*) FILTER (WHERE sl.status = 'IN_PROGRESS' AND sl.qc_status = 'FAILED') as jobs_on_hold,
  COUNT(*) FILTER (WHERE sl.status = 'COMPLETED' AND sl.qc_status = 'PENDING') as jobs_awaiting_qc,
  COUNT(*) FILTER (
    WHERE sl.pickup_required = true 
    AND EXISTS (
      SELECT 1 FROM pickup_delivery_tasks pdt 
      WHERE pdt.lead_id = sl.id 
      AND pdt.status IN ('PENDING', 'ASSIGNED')
    )
  ) as pending_pickups,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM lead_extra_charges lec 
      WHERE lec.lead_id = sl.id AND lec.status = 'PENDING'
    )
  ) as pending_extra_work_approvals,
  COUNT(*) FILTER (WHERE sl.sla_status IN ('AT_RISK', 'BREACHED')) as sla_at_risk_jobs
FROM public.service_leads sl
WHERE sl.status NOT IN ('REJECTED', 'CANCELLED')
GROUP BY sl.workshop_id;

COMMENT ON VIEW supervisor_dashboard_metrics IS 'Real-time metrics for supervisor dashboard by workshop';

-- ============================================
-- 10. Grant permissions (adjust as needed)
-- ============================================

-- Grant access to supervisor role
GRANT SELECT, INSERT, UPDATE ON public.qc_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mechanic_assignments TO authenticated;
GRANT SELECT, INSERT ON public.supervisor_actions TO authenticated;
GRANT SELECT ON supervisor_dashboard_metrics TO authenticated;

-- ============================================
-- Migration Complete!
-- ============================================

-- Verification queries:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('qc_checks', 'mechanic_assignments', 'supervisor_actions');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name LIKE 'qc%';
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('qc_checks', 'mechanic_assignments', 'supervisor_actions');

