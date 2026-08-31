-- HARD DELETE workshop junk staff — rows removed permanently (not is_active).
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54
-- Run in Supabase SQL editor (needs permission on auth.users).
--
-- KEEPS (do not delete):
--   pronewsinfodata@gmail.com, aman.g@roadserve.in
--   roadservedigital@gmail.com, myfng10@gmail.com
--   projectsindia2@gmail.com
--   vijayshinde121@gmail.com

-- Step 0: preview IDs that will be deleted
SELECT ul.id, ul.email, ul.full_name, r.role_name
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
  AND lower(ul.email) IN (
    'pramod@expressautocare.in',
    'vijaypick@gmail.com',
    'rishikesh@expressautocare.in',
    'ganesh@expressautocare.in',
    'aamir@expressautocare.in',
    'vijaymech@gmail.com',
    'ashish@expressautocare.in',
    'aman@expressautocare.in',
    'service@expressautocare.in',
    'vijayshinde@gmail.com',
    'info@myfng.in',
    'shubham@roadserve.in',
    'aman@myfng.in'
  )
ORDER BY r.role_name, ul.email;

-- Step 1: delete (run after preview looks correct)
DO $$
DECLARE
  doomed uuid[];
BEGIN
  SELECT coalesce(array_agg(ul.id), '{}') INTO doomed
  FROM users_login ul
  WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
    AND lower(ul.email) IN (
      'pramod@expressautocare.in',
      'vijaypick@gmail.com',
      'rishikesh@expressautocare.in',
      'ganesh@expressautocare.in',
      'aamir@expressautocare.in',
      'vijaymech@gmail.com',
      'ashish@expressautocare.in',
      'aman@expressautocare.in',
      'service@expressautocare.in',
      'vijayshinde@gmail.com',
      'info@myfng.in',
      'shubham@roadserve.in',
      'aman@myfng.in'
    );

  IF array_length(doomed, 1) IS NULL THEN
    RAISE NOTICE 'No matching users to delete.';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting % user(s): %', array_length(doomed, 1), doomed;

  -- Clear lead assignments
  UPDATE service_leads SET assigned_pickup_boy_id = NULL, updated_at = now()
    WHERE assigned_pickup_boy_id = ANY(doomed);
  UPDATE service_leads SET assigned_mechanic_id = NULL, updated_at = now()
    WHERE assigned_mechanic_id = ANY(doomed);
  UPDATE service_leads SET assigned_supervisor_id = NULL, updated_at = now()
    WHERE assigned_supervisor_id = ANY(doomed);
  UPDATE service_leads SET assigned_pickup_id = NULL, updated_at = now()
    WHERE assigned_pickup_id = ANY(doomed);
  UPDATE service_leads SET assigned_to_id = NULL, updated_at = now()
    WHERE assigned_to_id = ANY(doomed);
  UPDATE service_leads SET assigned_by = NULL, updated_at = now()
    WHERE assigned_by = ANY(doomed);
  UPDATE service_leads SET assigned_by_workshop_admin_id = NULL, updated_at = now()
    WHERE assigned_by_workshop_admin_id = ANY(doomed);
  UPDATE service_leads SET team_assigned_by_id = NULL, updated_at = now()
    WHERE team_assigned_by_id = ANY(doomed);
  UPDATE service_leads SET qc_performed_by = NULL, updated_at = now()
    WHERE qc_performed_by = ANY(doomed);
  UPDATE service_leads SET marked_ready_by = NULL, updated_at = now()
    WHERE marked_ready_by = ANY(doomed);
  UPDATE service_leads SET audit_performed_by = NULL, updated_at = now()
    WHERE audit_performed_by = ANY(doomed);
  UPDATE service_leads SET invoice_generated_by = NULL, updated_at = now()
    WHERE invoice_generated_by = ANY(doomed);
  UPDATE service_leads SET closed_by_id = NULL, updated_at = now()
    WHERE closed_by_id = ANY(doomed);
  UPDATE service_leads SET validated_by_id = NULL, updated_at = now()
    WHERE validated_by_id = ANY(doomed);
  UPDATE service_leads SET escalated_to_id = NULL, updated_at = now()
    WHERE escalated_to_id = ANY(doomed);
  UPDATE service_leads SET marked_fraud_by = NULL, updated_at = now()
    WHERE marked_fraud_by = ANY(doomed);
  UPDATE service_leads SET pickup_observation_required_set_by = NULL, updated_at = now()
    WHERE pickup_observation_required_set_by = ANY(doomed);

  -- Pickup / mechanic tables
  UPDATE pickup_tracking SET pickup_assigned_to = NULL, updated_at = now()
    WHERE pickup_assigned_to = ANY(doomed);
  UPDATE pickup_tracking SET drop_assigned_to = NULL, updated_at = now()
    WHERE drop_assigned_to = ANY(doomed);
  UPDATE pickup_tracking SET pickup_handover_to_workshop_by = NULL, updated_at = now()
    WHERE pickup_handover_to_workshop_by = ANY(doomed);
  UPDATE pickup_tracking SET invoice_paid_by = NULL, updated_at = now()
    WHERE invoice_paid_by = ANY(doomed);

  DELETE FROM mechanic_jobs WHERE mechanic_id = ANY(doomed) OR assigned_by = ANY(doomed);
  DELETE FROM mechanic_assignments WHERE mechanic_id = ANY(doomed) OR assigned_by = ANY(doomed);
  DELETE FROM pickup_location_tracking WHERE pickup_boy_id = ANY(doomed);
  DELETE FROM pickup_boy_metrics WHERE pickup_boy_id = ANY(doomed);
  DELETE FROM pickup_delivery_tasks WHERE assigned_to_id = ANY(doomed) OR assigned_by_id = ANY(doomed) OR created_by_id = ANY(doomed);
  DELETE FROM user_login_history WHERE user_id = ANY(doomed);
  DELETE FROM whatsapp_chat_reads WHERE user_id = ANY(doomed);

  UPDATE users_login SET manager_id = NULL WHERE manager_id = ANY(doomed);
  UPDATE notifications SET user_id = NULL WHERE user_id = ANY(doomed);
  UPDATE notifications SET related_user_id = NULL WHERE related_user_id = ANY(doomed);

  -- App profile rows
  DELETE FROM users_login WHERE id = ANY(doomed);

  -- Auth login (Supabase) — same UUID as users_login.id
  DELETE FROM auth.users WHERE id = ANY(doomed);

  RAISE NOTICE 'Done. Deleted from users_login + auth.users.';
END $$;

-- Step 2: verify — only kept staff should remain
SELECT r.role_name, ul.full_name, ul.email, ul.is_active
FROM users_login ul
JOIN roles r ON r.id = ul.role_id
WHERE ul.workshop_id = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54'
ORDER BY r.role_name, ul.full_name;
