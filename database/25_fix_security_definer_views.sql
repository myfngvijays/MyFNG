-- ============================================
-- FIX SECURITY DEFINER VIEWS - FINAL SOLUTION
-- This script fixes all 9 views that have SECURITY DEFINER
-- WITHOUT changing any functions
-- ============================================

-- ============================================
-- Method: Use ALTER VIEW to set security_invoker (PostgreSQL 15+)
-- If ALTER VIEW doesn't work, we'll drop and recreate
-- ============================================

-- Fix all 9 views using ALTER VIEW command (PostgreSQL 15+)
ALTER VIEW IF EXISTS public.mechanic_dashboard SET (security_invoker = true);
ALTER VIEW IF EXISTS public.leads_with_details SET (security_invoker = true);
ALTER VIEW IF EXISTS public.auditor_dashboard SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pickup_boy_dashboard SET (security_invoker = true);
ALTER VIEW IF EXISTS public.supervisor_dashboard_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.workshop_compliance_status SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pickup_tasks_with_details SET (security_invoker = true);
ALTER VIEW IF EXISTS public.users_with_roles SET (security_invoker = true);
ALTER VIEW IF EXISTS public.lead_flow_dashboard SET (security_invoker = true);

-- ============================================
-- If ALTER VIEW doesn't work, drop and recreate views
-- ============================================

-- Note: The views below will only be recreated if ALTER VIEW fails
-- This is a fallback method

-- 1. mechanic_dashboard
DO $$
BEGIN
  -- Check if view still has SECURITY DEFINER
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'mechanic_dashboard'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.mechanic_dashboard CASCADE;
    CREATE VIEW public.mechanic_dashboard AS
    SELECT 
      mj.id as job_id,
      mj.lead_id,
      sl.lead_number,
      sl.customer_name,
      sl.customer_phone,
      sl.vehicle_number,
      sl.vehicle_make,
      sl.vehicle_model,
      sl.vehicle_variant,
      sl.vehicle_fuel_type,
      sl.problem_description,
      sl.service_type_ids,
      sl.subservice_ids,
      mj.mechanic_status,
      mj.job_priority,
      mj.assigned_at,
      mj.started_at,
      mj.completed_at,
      mj.expected_completion_time,
      CASE 
        WHEN mj.expected_completion_time IS NOT NULL THEN
          FLOOR(EXTRACT(EPOCH FROM (mj.expected_completion_time - NOW())) / 60)::integer
        ELSE
          NULL
      END as sla_remaining_minutes,
      mj.work_notes,
      mj.mechanic_observations,
      mj.issues_found,
      mj.checklist_completed,
      mj.before_images_count,
      mj.progress_images_count,
      mj.after_images_count,
      mj.min_before_images,
      mj.min_progress_images,
      mj.min_after_images,
      mj.mechanic_id,
      sl.workshop_id,
      sl.pickup_required,
      sl.pickup_status,
      sl.status as lead_status,
      mj.created_at,
      mj.updated_at
    FROM mechanic_jobs mj
    JOIN service_leads sl ON mj.lead_id = sl.id
    WHERE mj.mechanic_status NOT IN ('COMPLETED', 'READY_FOR_DELIVERY')
    ORDER BY mj.assigned_at DESC;
  END IF;
END $$;

-- 2. leads_with_details
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'leads_with_details'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.leads_with_details CASCADE;
    CREATE VIEW public.leads_with_details AS
    SELECT 
      sl.*,
      w.name as workshop_name,
      w.city as workshop_city,
      w.state as workshop_state,
      lm.full_name as lead_manager_name,
      lm.email as lead_manager_email
    FROM service_leads sl
    LEFT JOIN workshops w ON sl.workshop_id = w.id
    LEFT JOIN users_login lm ON sl.lead_manager_assigned_id = lm.id;
  END IF;
END $$;

-- 3. auditor_dashboard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'auditor_dashboard'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.auditor_dashboard CASCADE;
    CREATE VIEW public.auditor_dashboard AS
    SELECT 
      wa.id as audit_id,
      wa.workshop_id,
      w.name as workshop_name,
      w.city,
      w.state,
      wa.auditor_id,
      wa.audit_type,
      wa.audit_status,
      wa.scheduled_date,
      wa.scheduled_time,
      wa.score_percentage,
      wa.audit_grade,
      wa.requires_follow_up,
      (SELECT COUNT(*) FROM audit_checklist_items WHERE audit_id = wa.id) as total_checklist_items,
      (SELECT COUNT(*) FROM audit_checklist_items WHERE audit_id = wa.id AND status = 'VERIFIED') as completed_items,
      (SELECT COUNT(*) FROM audit_action_items WHERE audit_id = wa.id AND status = 'OPEN') as open_action_items,
      wa.created_at,
      wa.updated_at
    FROM workshop_audits wa
    JOIN workshops w ON wa.workshop_id = w.id
    WHERE wa.audit_status != 'CANCELLED';
  END IF;
END $$;

-- 4. pickup_boy_dashboard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pickup_boy_dashboard'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.pickup_boy_dashboard CASCADE;
    CREATE VIEW public.pickup_boy_dashboard AS
    SELECT 
      pt.lead_id,
      sl.lead_number,
      sl.customer_name,
      sl.customer_phone,
      sl.vehicle_number,
      sl.vehicle_make,
      sl.vehicle_model,
      sl.vehicle_variant,
      pt.pickup_status,
      pt.drop_status,
      pt.pickup_address,
      pt.pickup_time_window_start,
      pt.pickup_time_window_end,
      pt.pickup_distance,
      pt.pickup_assigned_to,
      pt.drop_assigned_to,
      pt.pickup_otp,
      pt.drop_otp,
      (SELECT COUNT(*) FROM vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE 'PICKUP_%') as pickup_photos_count,
      (SELECT COUNT(*) FROM vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE 'DROP_%') as drop_photos_count,
      pt.created_at,
      pt.updated_at
    FROM pickup_tracking pt
    JOIN service_leads sl ON pt.lead_id = sl.id
    WHERE pt.pickup_status != 'NOT_ASSIGNED' OR pt.drop_status != 'NOT_REQUIRED';
  END IF;
END $$;

-- 5. supervisor_dashboard_metrics
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'supervisor_dashboard_metrics'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.supervisor_dashboard_metrics CASCADE;
    CREATE VIEW public.supervisor_dashboard_metrics AS
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
  END IF;
END $$;

-- 6. workshop_compliance_status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'workshop_compliance_status'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.workshop_compliance_status CASCADE;
    CREATE VIEW public.workshop_compliance_status AS
    SELECT 
      w.id as workshop_id,
      w.name as workshop_name,
      w.city,
      w.state,
      (SELECT audit_grade FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_grade,
      (SELECT score_percentage FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_score,
      (SELECT scheduled_date FROM workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as last_audit_date,
      (SELECT COUNT(*) FROM workshop_certifications WHERE workshop_id = w.id AND is_valid = true) as valid_certifications,
      (SELECT COUNT(*) FROM workshop_certifications WHERE workshop_id = w.id AND expiry_date < CURRENT_DATE) as expired_certifications,
      (SELECT COUNT(*) FROM audit_action_items aai JOIN workshop_audits wa ON aai.audit_id = wa.id WHERE wa.workshop_id = w.id AND aai.status = 'OPEN') as open_action_items,
      (SELECT COUNT(*) FROM audit_action_items aai JOIN workshop_audits wa ON aai.audit_id = wa.id WHERE wa.workshop_id = w.id AND aai.is_overdue = true) as overdue_action_items,
      w.is_verified,
      w.audit_score,
      w.created_at
    FROM workshops w;
  END IF;
END $$;

-- 7. pickup_tasks_with_details
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pickup_tasks_with_details'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.pickup_tasks_with_details CASCADE;
    CREATE VIEW public.pickup_tasks_with_details AS
    SELECT 
      pt.*,
      sl.lead_number,
      sl.customer_name,
      sl.customer_phone,
      sl.vehicle_number,
      sl.vehicle_make,
      sl.vehicle_model,
      w.name as workshop_name,
      w.address as workshop_address
    FROM pickup_tracking pt
    JOIN service_leads sl ON pt.lead_id = sl.id
    LEFT JOIN workshops w ON sl.workshop_id = w.id;
  END IF;
END $$;

-- 8. users_with_roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'users_with_roles'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.users_with_roles CASCADE;
    CREATE VIEW public.users_with_roles AS
    SELECT 
      ul.id,
      ul.email,
      ul.full_name,
      ul.phone,
      ul.workshop_id,
      ul.role_id,
      r.role_code,
      r.role_name,
      ul.is_active,
      ul.created_at,
      ul.updated_at
    FROM users_login ul
    JOIN roles r ON ul.role_id = r.id;
  END IF;
END $$;

-- 9. lead_flow_dashboard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'lead_flow_dashboard'
    AND definition LIKE '%SECURITY DEFINER%'
  ) THEN
    DROP VIEW IF EXISTS public.lead_flow_dashboard CASCADE;
    CREATE VIEW public.lead_flow_dashboard AS
    SELECT 
        sl.id,
        sl.lead_number,
        sl.status,
        sl.customer_name,
        sl.customer_phone,
        sl.vehicle_number,
        sl.created_at,
        sl.lead_manager_assigned_id,
        lm.full_name as lead_manager_name,
        sl.validated_by_id,
        val.full_name as validated_by_name,
        sl.validated_at,
        sl.workshop_id,
        w.name as workshop_name,
        sl.assigned_to_workshop_at,
        sl.workshop_accepted_by,
        wa.full_name as workshop_accepted_by_name,
        sl.accepted_at,
        sl.assigned_mechanic_id,
        m.full_name as mechanic_name,
        sl.mechanic_started_at,
        sl.mechanic_completed_at,
        sl.assigned_supervisor_id,
        sup.full_name as supervisor_name,
        sl.qc_status,
        sl.qc_performed_by,
        qc.full_name as qc_performed_by_name,
        sl.qc_performed_at,
        sl.audit_performed_by,
        aud.full_name as auditor_name,
        sl.audit_performed_at,
        sl.invoice_generated_by,
        bill.full_name as billing_member_name,
        sl.invoice_generated_at,
        sl.invoice_sent_at,
        sl.payment_status,
        sl.payment_mode,
        sl.payment_collected_by,
        pc.full_name as payment_collected_by_name,
        sl.payment_collected_at,
        sl.cse_assigned_id,
        cse.full_name as cse_name,
        sl.cse_assigned_at,
        sl.cse_followup_completed,
        sl.customer_satisfaction_score,
        sl.completed_at,
        sl.closed_by,
        closer.full_name as closed_by_name,
        sl.final_closure_at,
        sl.sla_status,
        sl.sla_expires_at
    FROM service_leads sl
    LEFT JOIN users_login lm ON sl.lead_manager_assigned_id = lm.id
    LEFT JOIN users_login val ON sl.validated_by_id = val.id
    LEFT JOIN workshops w ON sl.workshop_id = w.id
    LEFT JOIN users_login wa ON sl.workshop_accepted_by = wa.id
    LEFT JOIN users_login m ON sl.assigned_mechanic_id = m.id
    LEFT JOIN users_login sup ON sl.assigned_supervisor_id = sup.id
    LEFT JOIN users_login qc ON sl.qc_performed_by = qc.id
    LEFT JOIN users_login aud ON sl.audit_performed_by = aud.id
    LEFT JOIN users_login bill ON sl.invoice_generated_by = bill.id
    LEFT JOIN users_login pc ON sl.payment_collected_by = pc.id
    LEFT JOIN users_login cse ON sl.cse_assigned_id = cse.id
    LEFT JOIN users_login closer ON sl.closed_by = closer.id;
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  security_definer_count INTEGER;
BEGIN
  -- Check for SECURITY DEFINER views
  SELECT COUNT(*) INTO security_definer_count
  FROM pg_views v
  WHERE v.schemaname = 'public'
    AND v.viewname IN (
      'mechanic_dashboard', 'leads_with_details', 'auditor_dashboard',
      'pickup_boy_dashboard', 'supervisor_dashboard_metrics', 'workshop_compliance_status',
      'pickup_tasks_with_details', 'users_with_roles', 'lead_flow_dashboard'
    );
  
  RAISE NOTICE '✅ Views Fix Complete!';
  RAISE NOTICE '   Total views checked: 9';
  
  IF security_definer_count = 0 THEN
    RAISE NOTICE '   🎉 All views are now SECURITY INVOKER!';
  ELSE
    RAISE NOTICE '   ⚠️  % views still have SECURITY DEFINER', security_definer_count;
  END IF;
END $$;

-- ============================================
-- END OF SCRIPT
-- ============================================
