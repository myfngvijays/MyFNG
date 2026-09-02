export type CustomerAccountStatus = 'ACTIVE' | 'DEACTIVATED' | 'BANNED';
export type CustomerAccountAction = 'deactivate' | 'ban' | 'reactivate';

export function normalizeCustomerAccountStatus(raw: unknown): CustomerAccountStatus {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'BANNED') return 'BANNED';
  if (value === 'DEACTIVATED') return 'DEACTIVATED';
  return 'ACTIVE';
}

export function customerAccountStatusLabel(status: CustomerAccountStatus | null | undefined) {
  if (status === 'BANNED') return 'Banned';
  if (status === 'DEACTIVATED') return 'Deactivated';
  return 'Active';
}

export function customerAccountStatusBadgeClass(status: CustomerAccountStatus | null | undefined) {
  if (status === 'BANNED') return 'bg-red-100 text-red-800';
  if (status === 'DEACTIVATED') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

export function resolveCustomerAccountStatus(
  accountStatus: unknown,
  isActive: unknown,
): CustomerAccountStatus {
  const normalized = normalizeCustomerAccountStatus(accountStatus);
  if (normalized !== 'ACTIVE') return normalized;
  return isActive === false ? 'DEACTIVATED' : 'ACTIVE';
}

export function isCustomerAccountBlocked(isActive: unknown, accountStatus?: unknown) {
  return resolveCustomerAccountStatus(accountStatus, isActive) !== 'ACTIVE';
}

export function customerAccountBlockMessage(status: CustomerAccountStatus) {
  if (status === 'BANNED') {
    return 'Your account has been banned. Please contact MyFNG support.';
  }
  if (status === 'DEACTIVATED') {
    return 'Your account is deactivated. Please contact MyFNG support.';
  }
  return 'Your account is not active.';
}

export async function setCustomerAccountStatus(
  supabaseAdmin: any,
  input: {
    customerId: string;
    action: CustomerAccountAction;
    reason?: string | null;
    adminUserId?: string | null;
  },
) {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, phone, full_name, is_active, account_status')
    .eq('id', input.customerId)
    .maybeSingle();

  if (!customer) {
    return { ok: false as const, status: 404, error: 'Customer not found' };
  }

  const action = input.action;
  const nowIso = new Date().toISOString();
  let nextStatus: CustomerAccountStatus = 'ACTIVE';
  let nextActive = true;

  const reason = String(input.reason || '').trim();
  if ((action === 'deactivate' || action === 'ban') && !reason) {
    return {
      ok: false as const,
      status: 400,
      error: action === 'ban' ? 'Ban reason is required' : 'Deactivate reason is required',
    };
  }

  if (action === 'deactivate') {
    nextStatus = 'DEACTIVATED';
    nextActive = false;
  } else if (action === 'ban') {
    nextStatus = 'BANNED';
    nextActive = false;
  } else if (action === 'reactivate') {
    nextStatus = 'ACTIVE';
    nextActive = true;
  } else {
    return { ok: false as const, status: 400, error: 'Invalid action' };
  }

  const updatePayload: Record<string, unknown> = {
    is_active: nextActive,
    updated_at: nowIso,
    account_status: nextStatus,
    account_status_reason:
      nextStatus === 'ACTIVE' ? null : String(input.reason || '').trim() || null,
    account_status_changed_at: nowIso,
    account_status_changed_by: input.adminUserId || null,
  };

  let { data: updated, error } = await supabaseAdmin
    .from('customers')
    .update(updatePayload)
    .eq('id', input.customerId)
    .select('id, phone, full_name, is_active, account_status, account_status_reason, account_status_changed_at')
    .single();

  if (error && /does not exist|column/i.test(error.message || '')) {
    ({ data: updated, error } = await supabaseAdmin
      .from('customers')
      .update({
        is_active: nextActive,
        updated_at: nowIso,
      })
      .eq('id', input.customerId)
      .select('id, phone, full_name, is_active')
      .single());
  }

  if (error || !updated) {
    return {
      ok: false as const,
      status: 500,
      error: 'Failed to update account status',
      details: error?.message,
    };
  }

  if (!nextActive) {
    await supabaseAdmin.from('customer_sessions').delete().eq('customer_id', input.customerId);
  }

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: input.customerId,
    event_name: `account_${action}`,
    event_group: 'account',
    properties: {
      previous_status: resolveCustomerAccountStatus(customer.account_status, customer.is_active),
      new_status: nextStatus,
      reason: input.reason || null,
      admin_user_id: input.adminUserId || null,
    },
  });

  return {
    ok: true as const,
    customer: {
      ...updated,
      account_status: resolveCustomerAccountStatus(updated.account_status, updated.is_active),
    },
  };
}
