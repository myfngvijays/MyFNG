-- ============================================
-- 75_add_missing_auditor_functions.sql
-- Add missing functions for workshop audits and other auditor features
-- NOTE: Most functions already exist in 10_auditor_enhancements.sql
-- This migration only adds missing pieces or ensures they exist
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Checking and adding missing auditor functions...';
END $$;

-- ============================================
-- NOTE: Functions calculate_audit_score, calculate_category_scores, 
-- and calculate_auditor_metrics already exist in 10_auditor_enhancements.sql
-- We'll only add check_expired_certifications if it doesn't exist
-- ============================================

-- ============================================
-- 1. FUNCTION: Check Expired Certifications
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_expired_certifications'
  ) THEN
    EXECUTE '
    CREATE FUNCTION check_expired_certifications()
    RETURNS void
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      UPDATE workshop_certifications
      SET 
        is_valid = FALSE,
        verification_status = ''EXPIRED''::verification_status,
        updated_at = NOW()
      WHERE expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
        AND is_valid = TRUE;
      
      UPDATE workshop_certifications
      SET 
        renewal_required = TRUE,
        renewal_reminder_date = expiry_date - INTERVAL ''30 days'',
        updated_at = NOW()
      WHERE expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL ''30 days''
        AND renewal_required = FALSE;
    END;
    $func$;';
    RAISE NOTICE '✅ Created check_expired_certifications function';
  ELSE
    RAISE NOTICE '✅ check_expired_certifications function already exists, skipping';
  END IF;
END $$;

COMMENT ON FUNCTION check_expired_certifications() IS 'Marks expired certifications and sets renewal reminders';

-- ============================================
-- 2. TRIGGERS: Ensure triggers exist
-- ============================================

-- Trigger function for workshop audit checklist updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'trigger_update_audit_scores'
  ) THEN
    EXECUTE '
    CREATE FUNCTION trigger_update_audit_scores()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      PERFORM calculate_audit_score(NEW.audit_id);
      PERFORM calculate_category_scores(NEW.audit_id);
      RETURN NEW;
    END;
    $func$;';
    RAISE NOTICE '✅ Created trigger_update_audit_scores function';
  ELSE
    RAISE NOTICE '✅ trigger_update_audit_scores function already exists, skipping';
  END IF;
END $$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_audit_scores ON audit_checklist_items;
CREATE TRIGGER trigger_update_audit_scores
AFTER INSERT OR UPDATE ON audit_checklist_items
FOR EACH ROW
EXECUTE FUNCTION trigger_update_audit_scores();

-- Trigger to set audit duration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'trigger_set_audit_duration'
  ) THEN
    EXECUTE '
    CREATE FUNCTION trigger_set_audit_duration()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      IF NEW.actual_start_time IS NOT NULL AND NEW.actual_end_time IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60;
      END IF;
      RETURN NEW;
    END;
    $func$;';
    RAISE NOTICE '✅ Created trigger_set_audit_duration function';
  ELSE
    RAISE NOTICE '✅ trigger_set_audit_duration function already exists, skipping';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_set_audit_duration ON workshop_audits;
CREATE TRIGGER trigger_set_audit_duration
BEFORE UPDATE ON workshop_audits
FOR EACH ROW
WHEN (OLD.actual_start_time IS DISTINCT FROM NEW.actual_start_time OR OLD.actual_end_time IS DISTINCT FROM NEW.actual_end_time)
EXECUTE FUNCTION trigger_set_audit_duration();

-- Trigger to mark overdue action items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'trigger_mark_overdue_actions'
  ) THEN
    EXECUTE '
    CREATE FUNCTION trigger_mark_overdue_actions()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.status NOT IN (''COMPLETED'', ''VERIFIED'', ''CANCELLED'') THEN
        NEW.is_overdue := TRUE;
      ELSE
        NEW.is_overdue := FALSE;
      END IF;
      RETURN NEW;
    END;
    $func$;';
    RAISE NOTICE '✅ Created trigger_mark_overdue_actions function';
  ELSE
    RAISE NOTICE '✅ trigger_mark_overdue_actions function already exists, skipping';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_mark_overdue_actions ON audit_action_items;
CREATE TRIGGER trigger_mark_overdue_actions
BEFORE INSERT OR UPDATE ON audit_action_items
FOR EACH ROW
EXECUTE FUNCTION trigger_mark_overdue_actions();

-- ============================================
-- 3. CREATE VIEWS (if they don't exist)
-- ============================================

-- Drop existing views first to avoid column mismatch errors
-- Note: CASCADE will drop dependent objects, use carefully
-- We need to drop views before recreating with different column structure
DO $$
BEGIN
  -- Check and drop auditor_dashboard
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'auditor_dashboard') THEN
    EXECUTE 'DROP VIEW IF EXISTS auditor_dashboard CASCADE';
    RAISE NOTICE '✅ Dropped existing auditor_dashboard view';
  END IF;
  
  -- Check and drop workshop_compliance_status
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'workshop_compliance_status') THEN
    EXECUTE 'DROP VIEW IF EXISTS workshop_compliance_status CASCADE';
    RAISE NOTICE '✅ Dropped existing workshop_compliance_status view';
  END IF;
END $$;

-- View for auditor dashboard (workshop audits only)
CREATE VIEW auditor_dashboard AS
SELECT 
  wa.id,
  wa.workshop_id,
  w.name as workshop_name,
  w.city as workshop_city,
  wa.audit_type,
  wa.audit_status,
  wa.scheduled_date,
  wa.overall_score,
  wa.score_percentage,
  wa.audit_grade,
  wa.escalated,
  wa.requires_follow_up,
  u.full_name as auditor_name,
  COUNT(DISTINCT aci.id) as checklist_items_count,
  -- Note: audit_findings references audits(id), not workshop_audits(id)
  -- So we can't join it here for workshop audits
  0 as findings_count,
  COUNT(DISTINCT aai.id) as action_items_count
FROM workshop_audits wa
LEFT JOIN workshops w ON w.id = wa.workshop_id
LEFT JOIN users_login u ON u.id = wa.auditor_id
LEFT JOIN audit_checklist_items aci ON aci.audit_id = wa.id
LEFT JOIN audit_action_items aai ON aai.audit_id = wa.id
GROUP BY wa.id, w.name, w.city, u.full_name, wa.audit_type, wa.audit_status, wa.scheduled_date, 
         wa.overall_score, wa.score_percentage, wa.audit_grade, wa.escalated, wa.requires_follow_up;

COMMENT ON VIEW auditor_dashboard IS 'Simplified view for auditor dashboard with aggregated data';

-- View for workshop compliance status
CREATE VIEW workshop_compliance_status AS
SELECT 
  w.id as workshop_id,
  w.name as workshop_name,
  w.city,
  MAX(wa.audit_grade) as latest_audit_grade,
  MAX(wa.score_percentage) as latest_score,
  MAX(wa.scheduled_date) as last_audit_date,
  COUNT(DISTINCT wa.id) FILTER (WHERE wa.audit_status = 'COMPLETED') as total_audits,
  COUNT(DISTINCT wc.id) FILTER (WHERE wc.is_valid = TRUE) as valid_certifications,
  COUNT(DISTINCT aai.id) FILTER (WHERE aai.status IN ('OPEN', 'IN_PROGRESS')) as open_action_items,
  COUNT(DISTINCT aai.id) FILTER (WHERE aai.is_overdue = TRUE) as overdue_action_items
FROM workshops w
LEFT JOIN workshop_audits wa ON wa.workshop_id = w.id
LEFT JOIN workshop_certifications wc ON wc.workshop_id = w.id
LEFT JOIN audit_action_items aai ON aai.workshop_id = w.id
GROUP BY w.id, w.name, w.city;

COMMENT ON VIEW workshop_compliance_status IS 'Workshop compliance summary with latest audit and certification status';

-- ============================================
-- COMPLETION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Auditor functions migration complete!';
  RAISE NOTICE '📋 Functions checked/created:';
  RAISE NOTICE '   - check_expired_certifications()';
  RAISE NOTICE '📋 Triggers ensured:';
  RAISE NOTICE '   - trigger_update_audit_scores';
  RAISE NOTICE '   - trigger_set_audit_duration';
  RAISE NOTICE '   - trigger_mark_overdue_actions';
  RAISE NOTICE '📋 Views created/updated:';
  RAISE NOTICE '   - auditor_dashboard';
  RAISE NOTICE '   - workshop_compliance_status';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Note: calculate_audit_score, calculate_category_scores, and';
  RAISE NOTICE '   calculate_auditor_metrics already exist in 10_auditor_enhancements.sql';
END $$;
