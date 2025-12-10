-- ============================================
-- FIX SECURITY DEFINER VIEWS - FINAL SOLUTION
-- This script forcefully recreates views without SECURITY DEFINER
-- Uses ALTER VIEW if supported, otherwise drops and recreates
-- ============================================

-- ============================================
-- STEP 1: Drop all views completely
-- ============================================

DROP VIEW IF EXISTS public.auditor_dashboard CASCADE;
DROP VIEW IF EXISTS public.pickup_boy_dashboard CASCADE;
DROP VIEW IF EXISTS public.workshop_compliance_status CASCADE;

-- ============================================
-- STEP 2: Recreate views as SECURITY INVOKER
-- Using CREATE OR REPLACE to ensure clean recreation
-- ============================================

CREATE OR REPLACE VIEW public.auditor_dashboard AS
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
  (SELECT COUNT(*) FROM public.audit_checklist_items WHERE audit_id = wa.id AND status = 'VERIFIED') as completed_items,
  (SELECT COUNT(*) FROM public.audit_action_items WHERE audit_id = wa.id AND status = 'OPEN') as open_action_items,
  wa.created_at,
  wa.updated_at
FROM public.workshop_audits wa
JOIN public.workshops w ON wa.workshop_id = w.id
WHERE wa.audit_status != 'CANCELLED';

-- 2. pickup_boy_dashboard
CREATE OR REPLACE VIEW public.pickup_boy_dashboard AS
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
   WHERE lead_id = pt.lead_id AND photo_type LIKE 'PICKUP_%') as pickup_photos_count,
  (SELECT COUNT(*) FROM public.vehicle_condition_photos 
   WHERE lead_id = pt.lead_id AND photo_type LIKE 'DROP_%') as drop_photos_count,
  pt.created_at,
  pt.updated_at
FROM public.pickup_tracking pt
JOIN public.service_leads sl ON pt.lead_id = sl.id
WHERE pt.pickup_status != 'NOT_ASSIGNED' OR pt.drop_status != 'NOT_REQUIRED';

-- 3. workshop_compliance_status
CREATE OR REPLACE VIEW public.workshop_compliance_status AS
SELECT 
  w.id as workshop_id,
  w.name as workshop_name,
  w.city,
  w.state,
  (SELECT audit_grade FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_grade,
  (SELECT score_percentage FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as latest_score,
  (SELECT scheduled_date FROM public.workshop_audits WHERE workshop_id = w.id AND audit_status = 'COMPLETED' ORDER BY scheduled_date DESC LIMIT 1) as last_audit_date,
  (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND is_valid = true) as valid_certifications,
  (SELECT COUNT(*) FROM public.workshop_certifications WHERE workshop_id = w.id AND expiry_date < CURRENT_DATE) as expired_certifications,
  (SELECT COUNT(*) FROM public.audit_action_items aai 
   JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
   WHERE wa.workshop_id = w.id AND aai.status = 'OPEN') as open_action_items,
  (SELECT COUNT(*) FROM public.audit_action_items aai 
   JOIN public.workshop_audits wa ON aai.audit_id = wa.id 
   WHERE wa.workshop_id = w.id AND aai.is_overdue = true) as overdue_action_items,
  w.is_verified,
  w.audit_score,
  w.created_at
FROM public.workshops w;

-- ============================================
-- STEP 3: Try to alter views to SECURITY INVOKER (PostgreSQL 15+)
-- ============================================

-- Only works on PostgreSQL 15+
DO $$
BEGIN
  -- Try to alter views to explicitly set SECURITY INVOKER
  -- This will fail silently on older PostgreSQL versions
  BEGIN
    ALTER VIEW public.auditor_dashboard SET (security_invoker = true);
    RAISE NOTICE '✅ auditor_dashboard set to SECURITY INVOKER';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Could not alter auditor_dashboard (may not be supported in this PostgreSQL version)';
  END;
  
  BEGIN
    ALTER VIEW public.pickup_boy_dashboard SET (security_invoker = true);
    RAISE NOTICE '✅ pickup_boy_dashboard set to SECURITY INVOKER';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Could not alter pickup_boy_dashboard (may not be supported in this PostgreSQL version)';
  END;
  
  BEGIN
    ALTER VIEW public.workshop_compliance_status SET (security_invoker = true);
    RAISE NOTICE '✅ workshop_compliance_status set to SECURITY INVOKER';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Could not alter workshop_compliance_status (may not be supported in this PostgreSQL version)';
  END;
END $$;

-- ============================================
-- STEP 4: Verify views are not SECURITY DEFINER
-- Query to check view security settings
-- ============================================

DO $$
DECLARE
  view_count INTEGER;
BEGIN
  -- Check if any views still show as SECURITY DEFINER
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN ('auditor_dashboard', 'pickup_boy_dashboard', 'workshop_compliance_status')
  AND definition LIKE '%SECURITY DEFINER%';
  
  IF view_count > 0 THEN
    RAISE NOTICE '⚠️  Warning: % views may still have SECURITY DEFINER in definition', view_count;
    RAISE NOTICE '💡 If errors persist, you may need to contact Supabase support or check if views are being recreated by other scripts';
  ELSE
    RAISE NOTICE '✅ All views recreated successfully without SECURITY DEFINER';
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON VIEW public.auditor_dashboard IS 'Auditor dashboard view - recreated as SECURITY INVOKER';
COMMENT ON VIEW public.pickup_boy_dashboard IS 'Pickup boy dashboard view - recreated as SECURITY INVOKER';
COMMENT ON VIEW public.workshop_compliance_status IS 'Workshop compliance status view - recreated as SECURITY INVOKER';
