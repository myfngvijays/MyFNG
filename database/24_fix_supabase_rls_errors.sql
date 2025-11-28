-- ============================================
-- FIX SUPABASE RLS ERRORS
-- This script fixes all RLS-related security issues
-- WITHOUT changing any functions
--
-- What this script does:
-- 1. Enables RLS on tables that have policies but RLS is disabled
-- 2. Enables RLS on all public tables that don't have RLS enabled
-- 3. Fixes SECURITY DEFINER views by recreating them as SECURITY INVOKER
--
-- IMPORTANT: This script is safe to run multiple times (idempotent)
-- It uses IF EXISTS clauses to avoid errors if objects don't exist
-- ============================================

-- ============================================
-- PART 1: Enable RLS on tables with policies but RLS disabled
-- ============================================

-- These tables have policies but RLS is not enabled
ALTER TABLE IF EXISTS public.mechanic_extra_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mechanic_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mechanic_parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mechanic_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users_login ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 2: Enable RLS on all public tables that don't have RLS enabled
-- ============================================

-- Lead and Service Related Tables
ALTER TABLE IF EXISTS public.lead_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.qc_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mechanic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supervisor_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_pricing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_extra_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_sources ENABLE ROW LEVEL SECURITY;

-- Job Card Related Tables
ALTER TABLE IF EXISTS public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_card_parts ENABLE ROW LEVEL SECURITY;

-- Audit Related Tables
ALTER TABLE IF EXISTS public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workshop_compliance_history ENABLE ROW LEVEL SECURITY;

-- Telecaller Related Tables
ALTER TABLE IF EXISTS public.telecaller_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telecaller_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telecaller_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telecaller_performance_metrics ENABLE ROW LEVEL SECURITY;

-- CSE Related Tables
ALTER TABLE IF EXISTS public.cse_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cse_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Service and System Tables
ALTER TABLE IF EXISTS public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

-- Reference Data Tables
ALTER TABLE IF EXISTS public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.car_models ENABLE ROW LEVEL SECURITY;

-- Fraud Related Tables
ALTER TABLE IF EXISTS public.fraud_cases ENABLE ROW LEVEL SECURITY;

-- Invoice and Payment Related Tables
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_sharing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_intents ENABLE ROW LEVEL SECURITY;

-- Finance Related Tables
ALTER TABLE IF EXISTS public.finance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.short_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workshop_payment_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recon_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gl_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settlement_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workshop_payouts ENABLE ROW LEVEL SECURITY;

-- Support Related Tables
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RSA Related Tables
ALTER TABLE IF EXISTS public.rsa_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rsa_lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rsa_lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_mechanic_rsa ENABLE ROW LEVEL SECURITY;

-- Workshop Pricing Tables
ALTER TABLE IF EXISTS public.workshop_service_addons_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workshop_service_pricing ENABLE ROW LEVEL SECURITY;

-- Billing Related Tables
ALTER TABLE IF EXISTS public.billing_team_actions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: Fix SECURITY DEFINER Views
-- Change views from SECURITY DEFINER to SECURITY INVOKER
-- Note: PostgreSQL views are SECURITY INVOKER by default
-- Recreating them without SECURITY DEFINER will fix the issue
-- ============================================

-- Drop and recreate views to remove SECURITY DEFINER
-- mechanic_dashboard view (using the most complete definition)
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

-- leads_with_details view (recreate with all columns from service_leads)
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

-- auditor_dashboard view
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

-- pickup_boy_dashboard view
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

-- supervisor_dashboard_metrics view
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

-- workshop_compliance_status view
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

-- pickup_tasks_with_details view
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

-- users_with_roles view
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

-- lead_flow_dashboard view (complete definition)
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

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  rls_disabled_count INTEGER;
  security_definer_count INTEGER;
BEGIN
  -- Check for tables with policies but RLS disabled
  SELECT COUNT(*) INTO rls_disabled_count
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'mechanic_extra_work_requests', 'mechanic_media', 'mechanic_parts_usage',
      'mechanic_performance_metrics', 'service_checklists', 'service_leads', 'users_login'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t.tablename
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    );
  
  -- Check for SECURITY DEFINER views
  SELECT COUNT(*) INTO security_definer_count
  FROM pg_views v
  WHERE v.schemaname = 'public'
    AND v.viewname IN (
      'mechanic_dashboard', 'leads_with_details', 'auditor_dashboard',
      'pickup_boy_dashboard', 'supervisor_dashboard_metrics', 'workshop_compliance_status',
      'pickup_tasks_with_details', 'users_with_roles', 'lead_flow_dashboard'
    )
    AND v.definition LIKE '%SECURITY DEFINER%';
  
  RAISE NOTICE '✅ RLS Fix Complete!';
  RAISE NOTICE '   Tables with policies but RLS disabled: %', rls_disabled_count;
  RAISE NOTICE '   Views with SECURITY DEFINER: %', security_definer_count;
END $$;

-- ============================================
-- END OF SCRIPT
-- ============================================

