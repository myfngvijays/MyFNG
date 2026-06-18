export const LEGACY_MEMBERSHIP_CODES = new Set(['BRONZE', 'SILVER', 'GOLD']);

export const MIGRATION_149_HINT =
  'Run `database/149_membership_admin.sql` in Supabase SQL editor to enable tagline, benefits icons, display order & 2nd-car fields.';

export function isAppMembershipPlan(code: unknown): boolean {
  return !LEGACY_MEMBERSHIP_CODES.has(String(code || '').toUpperCase());
}

export function filterAppMembershipPlans<T extends { code?: string }>(plans: T[]): T[] {
  return plans.filter((p) => isAppMembershipPlan(p.code));
}

function isMissingColumnError(message: string) {
  return /does not exist/i.test(message);
}

function normalizePlanCode(raw: unknown) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
}

export function buildPlanBasePayload(body: Record<string, unknown>) {
  return {
    code: normalizePlanCode(body.code),
    name: String(body.name || '').trim(),
    description: body.description || null,
    price: Number(body.price) || 0,
    duration_days: Number(body.duration_days) || 365,
    active: body.active !== undefined ? !!body.active : true,
  };
}

export function buildPlanExtendedPayload(body: Record<string, unknown>) {
  return {
    original_price: body.original_price != null ? Number(body.original_price) : null,
    tagline: body.tagline || null,
    badge: body.badge || 'MEMBERSHIP',
    period_label: body.period_label || '/ Year',
    display_order: Number(body.display_order) || 0,
    footer_note: body.footer_note || null,
    second_car_addon_price: Number(body.second_car_addon_price) || 299,
    second_car_addon_title: body.second_car_addon_title || '2nd Car Add-On',
    second_car_addon_description: body.second_car_addon_description || null,
    second_car_addon_icon: body.second_car_addon_icon || 'car-sport',
    second_car_addon_icon_class: body.second_car_addon_icon_class || null,
    second_car_addon_icon_url: body.second_car_addon_icon_url || null,
    total_benefits_value: body.total_benefits_value != null ? Number(body.total_benefits_value) : 6650,
    value_column_label: body.value_column_label || 'VALUE',
    total_benefits_label: body.total_benefits_label || 'Total Benefits Value',
    save_label: body.save_label || 'You Save',
    price_hero_label: body.price_hero_label || 'YOU PAY ONLY',
    price_hero_sub: body.price_hero_sub || 'All benefits · One full year · One car',
  };
}

const PLAN_BASE_UPDATE_KEYS = ['code', 'name', 'description', 'price', 'duration_days', 'active'] as const;
const PLAN_EXTENDED_UPDATE_KEYS = [
  'tagline',
  'badge',
  'period_label',
  'footer_note',
  'second_car_addon_title',
  'second_car_addon_description',
  'second_car_addon_icon',
  'second_car_addon_icon_class',
  'second_car_addon_icon_url',
  'original_price',
  'display_order',
  'second_car_addon_price',
  'total_benefits_value',
  'value_column_label',
  'total_benefits_label',
  'save_label',
  'price_hero_label',
  'price_hero_sub',
] as const;

export function buildPlanUpdatePayload(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of PLAN_BASE_UPDATE_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = key === 'code' ? normalizePlanCode(body.code) : body[key];
    }
  }
  if (body.price !== undefined) updates.price = Number(body.price) || 0;
  if (body.duration_days !== undefined) updates.duration_days = Number(body.duration_days) || 365;
  if (body.active !== undefined) updates.active = !!body.active;

  for (const key of PLAN_EXTENDED_UPDATE_KEYS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.original_price !== undefined) {
    updates.original_price = body.original_price == null ? null : Number(body.original_price);
  }
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  if (body.second_car_addon_price !== undefined) {
    updates.second_car_addon_price = Number(body.second_car_addon_price) || 0;
  }
  if (body.total_benefits_value !== undefined) {
    updates.total_benefits_value = Number(body.total_benefits_value) || 0;
  }

  return updates;
}

function pickBaseUpdateFields(updates: Record<string, unknown>) {
  const base = { updated_at: updates.updated_at };
  for (const key of PLAN_BASE_UPDATE_KEYS) {
    if (updates[key] !== undefined) base[key as keyof typeof base] = updates[key] as never;
  }
  return base;
}

export async function insertMembershipPlan(db: any, body: Record<string, unknown>) {
  const base = buildPlanBasePayload(body);
  const extended = buildPlanExtendedPayload(body);

  let result = await db.from('membership_plans').insert({ ...base, ...extended }).select().single();
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await db.from('membership_plans').insert(base).select().single();
    if (!result.error && result.data?.id) {
      const extResult = await db
        .from('membership_plans')
        .update(extended)
        .eq('id', result.data.id)
        .select()
        .single();
      if (!extResult.error && extResult.data) result.data = extResult.data;
    }
  }
  return result;
}

export async function updateMembershipPlan(db: any, id: string, body: Record<string, unknown>) {
  const updates = buildPlanUpdatePayload(body);

  let result = await db.from('membership_plans').update(updates).eq('id', id).select().single();
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await db.from('membership_plans').update(pickBaseUpdateFields(updates)).eq('id', id).select().single();
  }
  return result;
}

export async function deleteMembershipPlan(db: any, id: string) {
  const { count, error: countError } = await db
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id);

  if (countError) return { error: countError, data: null };

  if ((count || 0) > 0) {
    return {
      error: {
        message: `${count} customer(s) are subscribed to this plan`,
        code: 'PLAN_IN_USE',
        hint: 'Turn off "Active" to hide it from the app instead of deleting.',
      },
      data: null,
    };
  }

  const { count: benefitCount } = await db
    .from('membership_benefits')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id);

  const deleteResult = await db.from('membership_plans').delete().eq('id', id);
  if (deleteResult.error) return deleteResult;

  return { ...deleteResult, data: { deleted_benefits: benefitCount || 0 } };
}

export function buildBenefitBasePayload(body: Record<string, unknown>, planId: string) {
  const title = String(body.title || '').trim();
  const benefitCode = String(body.benefit_code || title)
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 50);

  return {
    plan_id: planId,
    benefit_code: benefitCode,
    title,
  };
}

export function buildBenefitExtendedPayload(body: Record<string, unknown>) {
  return {
    description: body.description || null,
    icon: body.icon || null,
    icon_url: body.icon_url || null,
    icon_class: body.icon_class || null,
    value_label: body.value_label || null,
    value_prefix: body.value_prefix || null,
    display_order: Number(body.display_order) || 0,
    active: body.active !== undefined ? !!body.active : true,
    updated_at: new Date().toISOString(),
  };
}

export async function insertMembershipBenefit(db: any, body: Record<string, unknown>) {
  const planId = String(body.plan_id || '');
  const base = buildBenefitBasePayload(body, planId);
  const extended = buildBenefitExtendedPayload(body);

  let result = await db.from('membership_benefits').insert({ ...base, ...extended }).select().single();
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await db.from('membership_benefits').insert(base).select().single();
  }
  return result;
}

export async function updateMembershipBenefit(db: any, id: string, body: Record<string, unknown>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.icon_url !== undefined) updates.icon_url = body.icon_url;
  if (body.icon_class !== undefined) updates.icon_class = body.icon_class;
  if (body.value_label !== undefined) updates.value_label = body.value_label;
  if (body.value_prefix !== undefined) updates.value_prefix = body.value_prefix;
  if (body.benefit_code !== undefined) updates.benefit_code = body.benefit_code;
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  if (body.active !== undefined) updates.active = !!body.active;

  let result = await db.from('membership_benefits').update(updates).eq('id', id).select().single();
  if (result.error && isMissingColumnError(result.error.message)) {
    const baseUpdates: Record<string, unknown> = {};
    if (body.title !== undefined) baseUpdates.title = body.title;
    if (body.benefit_code !== undefined) baseUpdates.benefit_code = body.benefit_code;
    result = await db.from('membership_benefits').update(baseUpdates).eq('id', id).select().single();
  }
  return result;
}

export function sortMembershipRows<T extends { display_order?: number | null; created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}
