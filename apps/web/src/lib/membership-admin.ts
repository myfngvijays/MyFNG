export type AdminActivateMembershipInput = {
  customerId: string;
  planId: string;
  addSecondCar?: boolean;
  primaryVehicleId?: string | null;
  secondVehicleId?: string | null;
  primaryVehicleSnapshot?: Record<string, unknown>;
  secondVehicleSnapshot?: Record<string, unknown> | null;
  notes?: string | null;
  adminUserId?: string | null;
};

export async function adminActivateCustomerMembership(
  supabaseAdmin: any,
  input: AdminActivateMembershipInput,
) {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, phone, full_name')
    .eq('id', input.customerId)
    .maybeSingle();

  if (!customer) {
    return { ok: false as const, status: 404, error: 'Customer not found' };
  }

  const { data: plan } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('id', input.planId)
    .eq('active', true)
    .maybeSingle();

  if (!plan) {
    return { ok: false as const, status: 400, error: 'Invalid or inactive membership plan' };
  }

  const now = new Date();
  const endsAt = new Date(
    now.getTime() + Number(plan.duration_days || 365) * 24 * 60 * 60 * 1000,
  );

  await supabaseAdmin
    .from('customer_memberships')
    .update({ status: 'EXPIRED', updated_at: now.toISOString() })
    .eq('customer_id', input.customerId)
    .eq('status', 'ACTIVE');

  const insertPayload = {
    customer_id: input.customerId,
    plan_id: plan.id,
    status: 'ACTIVE',
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    auto_renew: false,
    source: 'ADMIN',
    has_second_car: Boolean(input.addSecondCar),
    primary_vehicle_id: input.primaryVehicleId || null,
    second_vehicle_id: input.secondVehicleId || null,
    primary_vehicle_snapshot: input.primaryVehicleSnapshot || {},
    second_vehicle_snapshot: input.secondVehicleSnapshot || {},
  };

  let inserted: any = null;
  let insertError: any = null;
  ({ data: inserted, error: insertError } = await supabaseAdmin
    .from('customer_memberships')
    .insert(insertPayload)
    .select('*, plan:membership_plans(*)')
    .single());

  if (insertError && /does not exist|column/i.test(insertError.message || '')) {
    ({ data: inserted, error: insertError } = await supabaseAdmin
      .from('customer_memberships')
      .insert({
        customer_id: input.customerId,
        plan_id: plan.id,
        status: 'ACTIVE',
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: false,
        source: 'ADMIN',
      })
      .select('*, plan:membership_plans(*)')
      .single());
  }

  if (insertError || !inserted) {
    return {
      ok: false as const,
      status: 500,
      error: 'Failed to activate membership',
      details: insertError?.message || 'Could not save membership',
    };
  }

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: input.customerId,
    event_name: 'membership_admin_activated',
    event_group: 'membership',
    properties: {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_code: plan.code,
      membership_id: inserted.id,
      add_second_car: Boolean(input.addSecondCar),
      admin_user_id: input.adminUserId || null,
      notes: input.notes || null,
      source: 'ADMIN',
    },
  });

  return {
    ok: true as const,
    membership: inserted,
    ends_at: endsAt.toISOString(),
  };
}

export async function adminExpireCustomerMembership(
  supabaseAdmin: any,
  customerId: string,
  adminUserId?: string | null,
  notes?: string | null,
) {
  const nowIso = new Date().toISOString();
  const { data: activeRows } = await supabaseAdmin
    .from('customer_memberships')
    .select('id, plan_id')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE');

  if (!activeRows?.length) {
    return { ok: false as const, status: 400, error: 'No active membership to expire' };
  }

  const { error } = await supabaseAdmin
    .from('customer_memberships')
    .update({ status: 'EXPIRED', updated_at: nowIso, ends_at: nowIso })
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE');

  if (error) {
    return { ok: false as const, status: 500, error: 'Failed to expire membership', details: error.message };
  }

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: customerId,
    event_name: 'membership_admin_expired',
    event_group: 'membership',
    properties: {
      admin_user_id: adminUserId || null,
      notes: notes || null,
      expired_count: activeRows.length,
    },
  });

  return { ok: true as const, expired_count: activeRows.length };
}
