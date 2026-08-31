import type { SupabaseClient } from '@supabase/supabase-js';

/** Best-effort — skip columns/tables missing in this environment. */
function isSkippableSchemaError(message: string) {
  return /does not exist|could not find the .* column|schema cache|relation .* does not exist|not found in the schema/i.test(
    message || '',
  );
}

const SERVICE_LEAD_USER_COLUMNS = [
  'assigned_pickup_boy_id',
  'assigned_mechanic_id',
  'assigned_supervisor_id',
  'assigned_pickup_id',
  'assigned_to_id',
  'assigned_by',
  'assigned_by_workshop_admin_id',
  'team_assigned_by_id',
  'qc_performed_by',
  'marked_ready_by',
  'audit_performed_by',
  'invoice_generated_by',
  'closed_by_id',
  'validated_by_id',
  'escalated_to_id',
  'marked_fraud_by',
  'pickup_observation_required_set_by',
  'pickup_observation_by',
  'assigned_telecaller_id',
  'assigned_by_lead_manager_id',
] as const;

async function clearColumn(
  admin: SupabaseClient,
  table: string,
  column: string,
  userId: string,
) {
  const payload: Record<string, unknown> = { [column]: null };
  if (table === 'service_leads' || table === 'pickup_tracking' || table === 'users_login') {
    payload.updated_at = new Date().toISOString();
  }

  const { error } = await admin.from(table).update(payload as any).eq(column, userId);
  if (error && !isSkippableSchemaError(error.message || '')) {
    throw new Error(`${table}.${column}: ${error.message}`);
  }
}

async function deleteWhereOr(
  admin: SupabaseClient,
  table: string,
  filter: string,
) {
  const { error } = await admin.from(table).delete().or(filter);
  if (error && !isSkippableSchemaError(error.message || '')) {
    throw new Error(`${table}: ${error.message}`);
  }
}

/** Permanently remove a staff user from users_login + Supabase auth. */
export async function deleteStaffUserById(admin: SupabaseClient, userId: string) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('Missing user id');

  for (const column of SERVICE_LEAD_USER_COLUMNS) {
    await clearColumn(admin, 'service_leads', column, id);
  }

  for (const column of [
    'pickup_assigned_to',
    'drop_assigned_to',
    'pickup_handover_to_workshop_by',
    'invoice_paid_by',
  ]) {
    await clearColumn(admin, 'pickup_tracking', column, id);
  }

  await deleteWhereOr(admin, 'mechanic_jobs', `mechanic_id.eq.${id},assigned_by.eq.${id}`);
  await deleteWhereOr(admin, 'mechanic_assignments', `mechanic_id.eq.${id},assigned_by.eq.${id}`);
  await deleteWhereOr(admin, 'pickup_location_tracking', `pickup_boy_id.eq.${id}`);
  await deleteWhereOr(admin, 'pickup_boy_metrics', `pickup_boy_id.eq.${id}`);
  await deleteWhereOr(admin, 'user_login_history', `user_id.eq.${id}`);
  await deleteWhereOr(admin, 'whatsapp_chat_reads', `user_id.eq.${id}`);
  await deleteWhereOr(
    admin,
    'pickup_delivery_tasks',
    `assigned_to_id.eq.${id},assigned_by_id.eq.${id},created_by_id.eq.${id}`,
  );

  await clearColumn(admin, 'users_login', 'manager_id', id);
  await clearColumn(admin, 'notifications', 'user_id', id);
  await clearColumn(admin, 'notifications', 'related_user_id', id);

  const { error: profileError } = await admin.from('users_login').delete().eq('id', id);
  if (profileError) throw new Error(profileError.message || 'Failed to delete user profile');

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) throw new Error(authError.message || 'Failed to delete auth login');
}
