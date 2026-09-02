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
  startsAt?: string | null;
  endsAt?: string | null;
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

  const defaultStart = new Date();
  const startsAt = input.startsAt ? new Date(input.startsAt) : defaultStart;
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAt.getTime() + Number(plan.duration_days || 365) * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false as const, status: 400, error: 'Invalid start or end date' };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false as const, status: 400, error: 'End date must be after start date' };
  }

  const now = defaultStart;

  await supabaseAdmin
    .from('customer_memberships')
    .update({ status: 'EXPIRED', updated_at: now.toISOString() })
    .eq('customer_id', input.customerId)
    .eq('status', 'ACTIVE');

  const insertPayload = {
    customer_id: input.customerId,
    plan_id: plan.id,
    status: 'ACTIVE',
    starts_at: startsAt.toISOString(),
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
        starts_at: startsAt.toISOString(),
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
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source: 'ADMIN',
    },
  });

  return {
    ok: true as const,
    membership: inserted,
    starts_at: startsAt.toISOString(),
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

export async function saveMembershipClaimsButtonOverride(
  supabaseAdmin: any,
  input: {
    customerId: string;
    membershipId?: string | null;
    mode: string;
    adminUserId?: string | null;
  },
) {
  const { parseClaimsButtonOverride } = await import('@/lib/membership-benefits-service');
  const mode = parseClaimsButtonOverride(input.mode);
  const now = new Date().toISOString();
  const membershipId = String(input.membershipId || '').trim();
  let storedOnMembership = false;

  if (membershipId) {
    const { error } = await supabaseAdmin
      .from('customer_memberships')
      .update({ claims_button_override: mode, updated_at: now })
      .eq('id', membershipId)
      .eq('customer_id', input.customerId);
    if (error && !/column|does not exist|schema cache/i.test(String(error.message || ''))) {
      return { ok: false as const, status: 500, error: error.message };
    }
    storedOnMembership = !error;
  }

  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('id, preferences')
    .eq('customer_id', input.customerId)
    .maybeSingle();
  const prefs =
    profile?.preferences && typeof profile.preferences === 'object'
      ? { ...(profile.preferences as Record<string, unknown>) }
      : {};
  prefs.membership_claims_button = mode;

  if (profile?.id) {
    const { error } = await supabaseAdmin
      .from('customer_profiles')
      .update({ preferences: prefs, updated_at: now })
      .eq('id', profile.id);
    if (error) return { ok: false as const, status: 500, error: error.message };
  } else {
    const { error } = await supabaseAdmin.from('customer_profiles').insert({
      customer_id: input.customerId,
      preferences: prefs,
    });
    if (error) return { ok: false as const, status: 500, error: error.message };
  }

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: input.customerId,
    event_name: 'membership_claims_button_override',
    event_group: 'membership',
    properties: {
      mode,
      membership_id: membershipId || null,
      admin_user_id: input.adminUserId || null,
      stored: storedOnMembership ? 'membership' : 'profile',
    },
  });

  return {
    ok: true as const,
    mode,
    stored: storedOnMembership ? ('membership' as const) : ('profile' as const),
  };
}
