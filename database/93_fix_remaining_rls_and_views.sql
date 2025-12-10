-- ============================================
-- FIX REMAINING RLS AND SECURITY DEFINER VIEW ERRORS
-- Fixes views with SECURITY DEFINER and tables with RLS disabled
-- ============================================

-- ============================================
-- PART 1: Fix SECURITY DEFINER Views
-- Recreate views without SECURITY DEFINER
-- PostgreSQL 15+ supports SECURITY DEFINER on views, so we need to explicitly set SECURITY INVOKER
-- ============================================

-- First, check and drop any functions that might be recreating these views
DROP FUNCTION IF EXISTS public.refresh_auditor_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_pickup_boy_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_workshop_compliance_status() CASCADE;

-- 1. Fix auditor_dashboard view
-- Force drop with CASCADE to remove all dependencies
DROP VIEW IF EXISTS public.auditor_dashboard CASCADE;

-- Recreate view - PostgreSQL will default to SECURITY INVOKER if not specified
-- If your PostgreSQL version supports it, we explicitly set security_invoker
DO $$
BEGIN
  -- Check PostgreSQL version
  IF current_setting('server_version_num')::int >= 150000 THEN
    -- PostgreSQL 15+ supports explicit security_invoker
    EXECUTE 'CREATE VIEW public.auditor_dashboard WITH (security_invoker = true) AS
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
      (SELECT COUNT(*) FROM public.audit_checklist_items WHERE audit_id = wa.id) as total_checklist_items,
      (SELECT COUNT(*) FROM public.audit_checklist_items WHERE audit_id = wa.id AND status = ''VERIFIED'') as completed_items,
      (SELECT COUNT(*) FROM public.audit_action_items WHERE audit_id = wa.id AND status = ''OPEN'') as open_action_items,
      wa.created_at,
      wa.updated_at
    FROM public.workshop_audits wa
    JOIN public.workshops w ON wa.workshop_id = w.id
    WHERE wa.audit_status != ''CANCELLED''';
  ELSE
    -- For older versions, just create normally (defaults to SECURITY INVOKER)
    EXECUTE 'CREATE VIEW public.auditor_dashboard AS
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
      (SELECT COUNT(*) FROM public.audit_checklist_items WHERE audit_id = wa.id) as total_checklist_items,
      (SELECT COUNT(*) FROM public.audit_checklist_items WHERE audit_id = wa.id AND status = ''VERIFIED'') as completed_items,
      (SELECT COUNT(*) FROM public.audit_action_items WHERE audit_id = wa.id AND status = ''OPEN'') as open_action_items,
      wa.created_at,
      wa.updated_at
    FROM public.workshop_audits wa
    JOIN public.workshops w ON wa.workshop_id = w.id
    WHERE wa.audit_status != ''CANCELLED''';
  END IF;
END $$;
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
FROM public.workshop_audits wa
JOIN public.workshops w ON wa.workshop_id = w.id
WHERE wa.audit_status != 'CANCELLED';

-- 2. Fix pickup_boy_dashboard view
DROP VIEW IF EXISTS public.pickup_boy_dashboard CASCADE;

DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'CREATE VIEW public.pickup_boy_dashboard WITH (security_invoker = true) AS
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
      (SELECT COUNT(*) FROM public.vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE ''PICKUP_%'') as pickup_photos_count,
      (SELECT COUNT(*) FROM public.vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE ''DROP_%'') as drop_photos_count,
      pt.created_at,
      pt.updated_at
    FROM public.pickup_tracking pt
    JOIN public.service_leads sl ON pt.lead_id = sl.id
    WHERE pt.pickup_status != ''NOT_ASSIGNED'' OR pt.drop_status != ''NOT_REQUIRED''';
  ELSE
    EXECUTE 'CREATE VIEW public.pickup_boy_dashboard AS
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
      (SELECT COUNT(*) FROM public.vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE ''PICKUP_%'') as pickup_photos_count,
      (SELECT COUNT(*) FROM public.vehicle_condition_photos 
       WHERE lead_id = pt.lead_id AND photo_type LIKE ''DROP_%'') as drop_photos_count,
      pt.created_at,
      pt.updated_at
    FROM public.pickup_tracking pt
    JOIN public.service_leads sl ON pt.lead_id = sl.id
    WHERE pt.pickup_status != ''NOT_ASSIGNED'' OR pt.drop_status != ''NOT_REQUIRED''';
  END IF;
END $$;

-- 3. Fix workshop_compliance_status view
DROP VIEW IF EXISTS public.workshop_compliance_status CASCADE;

DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'CREATE VIEW public.workshop_compliance_status WITH (security_invoker = true) AS
    SELECT 
      w.id as workshop_id,
      w.name as workshop_name,
      w.city,
      w.state,
      (SELECT audit_grade FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as latest_grade,
      (SELECT score_percentage FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as latest_score,
      (SELECT scheduled_date FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as last_audit_date,
      (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND is_valid = true) as valid_certifications,
      (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND expiry_date < CURRENT_DATE) as expired_certifications,
      (SELECT COUNT(*) FROM public.audit_action_items aai 
       JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
       WHERE wa.workshop_id = w.id AND aai.status = ''OPEN'') as open_action_items,
      (SELECT COUNT(*) FROM public.audit_action_items aai 
       JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
       WHERE wa.workshop_id = w.id AND aai.is_overdue = true) as overdue_action_items,
      w.is_verified,
      w.audit_score,
      w.created_at
    FROM public.workshops w';
  ELSE
    EXECUTE 'CREATE VIEW public.workshop_compliance_status AS
    SELECT 
      w.id as workshop_id,
      w.name as workshop_name,
      w.city,
      w.state,
      (SELECT audit_grade FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as latest_grade,
      (SELECT score_percentage FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as latest_score,
      (SELECT scheduled_date FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = ''COMPLETED'' ORDER BY scheduled_date DESC LIMIT 1) as last_audit_date,
      (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND is_valid = true) as valid_certifications,
      (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND expiry_date < CURRENT_DATE) as expired_certifications,
      (SELECT COUNT(*) FROM public.audit_action_items aai 
       JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
       WHERE wa.workshop_id = w.id AND aai.status = ''OPEN'') as open_action_items,
      (SELECT COUNT(*) FROM public.audit_action_items aai 
       JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
       WHERE wa.workshop_id = w.id AND aai.is_overdue = true) as overdue_action_items,
      w.is_verified,
      w.audit_score,
      w.created_at
    FROM public.workshops w';
  END IF;
END $$;

-- ============================================
-- PART 2: Enable RLS on Missing Tables
-- ============================================

-- Enable RLS on audit_scoring_weights
ALTER TABLE IF EXISTS public.audit_scoring_weights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "audit_scoring_weights_select_policy" ON public.audit_scoring_weights;
DROP POLICY IF EXISTS "audit_scoring_weights_insert_policy" ON public.audit_scoring_weights;
DROP POLICY IF EXISTS "audit_scoring_weights_update_policy" ON public.audit_scoring_weights;
DROP POLICY IF EXISTS "audit_scoring_weights_delete_policy" ON public.audit_scoring_weights;

-- SELECT: Only Auditors, Super Admin, and Sub Admin can view
CREATE POLICY "audit_scoring_weights_select_policy" ON public.audit_scoring_weights
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('AUDITOR', 'SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

-- INSERT/UPDATE/DELETE: Only Super Admin
CREATE POLICY "audit_scoring_weights_insert_policy" ON public.audit_scoring_weights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "audit_scoring_weights_update_policy" ON public.audit_scoring_weights
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "audit_scoring_weights_delete_policy" ON public.audit_scoring_weights
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
  );

-- Enable RLS on chargeback_cases
ALTER TABLE IF EXISTS public.chargeback_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "chargeback_cases_select_policy" ON public.chargeback_cases;
DROP POLICY IF EXISTS "chargeback_cases_insert_policy" ON public.chargeback_cases;
DROP POLICY IF EXISTS "chargeback_cases_update_policy" ON public.chargeback_cases;
DROP POLICY IF EXISTS "chargeback_cases_delete_policy" ON public.chargeback_cases;

-- SELECT: Accounts Team, Finance, Super Admin, and assigned user can view
CREATE POLICY "chargeback_cases_select_policy" ON public.chargeback_cases
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('ACCOUNTS_TEAM', 'FINANCE', 'SUPER_ADMIN')
    )
  );

-- INSERT: Accounts Team, Finance, Super Admin (and system/webhook)
CREATE POLICY "chargeback_cases_insert_policy" ON public.chargeback_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('ACCOUNTS_TEAM', 'FINANCE', 'SUPER_ADMIN')
    )
    OR assigned_to = auth.uid()
  );

-- UPDATE: Assigned user, Accounts Team, Finance, Super Admin
CREATE POLICY "chargeback_cases_update_policy" ON public.chargeback_cases
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code IN ('ACCOUNTS_TEAM', 'FINANCE', 'SUPER_ADMIN')
    )
  );

-- DELETE: Only Super Admin
CREATE POLICY "chargeback_cases_delete_policy" ON public.chargeback_cases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      JOIN public.roles r ON ul.role_id = r.id
      WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON VIEW public.auditor_dashboard IS 'Dashboard view for auditors - recreated without SECURITY DEFINER';
COMMENT ON VIEW public.pickup_boy_dashboard IS 'Dashboard view for pickup boys - recreated without SECURITY DEFINER';
COMMENT ON VIEW public.workshop_compliance_status IS 'Workshop compliance status view - recreated without SECURITY DEFINER';

COMMENT ON POLICY "audit_scoring_weights_select_policy" ON public.audit_scoring_weights IS 'Allow Auditors, Super Admin, and Sub Admin to view scoring weights';
COMMENT ON POLICY "chargeback_cases_select_policy" ON public.chargeback_cases IS 'Allow assigned user, Accounts Team, Finance, and Super Admin to view chargeback cases';
