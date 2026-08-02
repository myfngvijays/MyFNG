-- ============================================================
-- 301_assign_all_leads_to_vijay_telecaller.sql
-- Assign all service leads to Vijay (primary telecaller).
-- New telecallers (Ajit, Bhushan) stay at 0% until admin changes distribution.
-- Run once in Supabase SQL editor.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_vijay_id UUID;
  v_updated_leads INT;
  v_updated_enquiry INT;
BEGIN
  SELECT u.id INTO v_vijay_id
  FROM users_login u
  JOIN roles r ON r.id = u.role_id
  WHERE UPPER(r.role_code) = 'TELECALLER'
    AND COALESCE(u.is_active, true) = true
    AND (
      u.full_name ILIKE '%vijay%'
      OR COALESCE(u.email, '') ILIKE '%vijay%'
    )
    AND COALESCE(u.full_name, '') NOT ILIKE '%ajit%'
    AND COALESCE(u.full_name, '') NOT ILIKE '%bhushan%'
  ORDER BY u.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_vijay_id IS NULL THEN
    RAISE EXCEPTION 'Vijay telecaller not found. Check users_login + TELECALLER role.';
  END IF;

  RAISE NOTICE 'Vijay telecaller id: %', v_vijay_id;

  UPDATE service_leads
  SET
    assigned_telecaller_id = v_vijay_id,
    assigned_at = COALESCE(assigned_at, NOW()),
    updated_at = NOW()
  WHERE deleted_at IS NULL
    AND assigned_telecaller_id IS DISTINCT FROM v_vijay_id;

  GET DIAGNOSTICS v_updated_leads = ROW_COUNT;

  UPDATE enquiry_hub
  SET
    assigned_telecaller_id = v_vijay_id,
    assigned_at = COALESCE(assigned_at, NOW()),
    assignment_mode = 'MANUAL',
    updated_at = NOW()
  WHERE kind = 'LEAD'
    AND assigned_telecaller_id IS DISTINCT FROM v_vijay_id;

  GET DIAGNOSTICS v_updated_enquiry = ROW_COUNT;

  -- Distribution: Vijay 100%, everyone else inactive (new telecallers get nothing auto-assigned)
  UPDATE enquiry_hub
  SET
    allocation_percent = 0,
    allocation_status = 'INACTIVE',
    updated_at = NOW()
  WHERE kind = 'ALLOCATION'
    AND is_active = true
    AND telecaller_id IS DISTINCT FROM v_vijay_id;

  UPDATE enquiry_hub
  SET
    allocation_percent = 100,
    allocation_status = 'ACTIVE',
    is_active = true,
    updated_at = NOW()
  WHERE kind = 'ALLOCATION'
    AND telecaller_id = v_vijay_id;

  IF NOT FOUND THEN
    INSERT INTO enquiry_hub (
      kind, is_active, telecaller_id, allocation_percent, allocation_status, created_at, updated_at
    ) VALUES (
      'ALLOCATION', true, v_vijay_id, 100, 'ACTIVE', NOW(), NOW()
    );
  END IF;

  RAISE NOTICE 'Updated service_leads: %, enquiry_hub LEAD rows: %', v_updated_leads, v_updated_enquiry;
END $$;

-- Verify counts per telecaller
SELECT
  u.full_name,
  u.email,
  COUNT(sl.id) AS assigned_leads
FROM users_login u
JOIN roles r ON r.id = u.role_id
LEFT JOIN service_leads sl
  ON sl.assigned_telecaller_id = u.id
 AND sl.deleted_at IS NULL
WHERE UPPER(r.role_code) = 'TELECALLER'
GROUP BY u.id, u.full_name, u.email
ORDER BY assigned_leads DESC, u.full_name;

COMMIT;
