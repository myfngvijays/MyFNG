import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { logCouponAudit } from '@/lib/coupon-rules';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) update.name = String(body.name).trim();
    if (body.description != null) update.description = String(body.description).trim();
    if (body.trigger_type != null) update.trigger_type = String(body.trigger_type).trim();
    if (body.action_type != null) update.action_type = String(body.action_type).trim();
    if (body.conditions != null) update.conditions = body.conditions;
    if (body.coupon_id !== undefined) update.coupon_id = body.coupon_id || null;
    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
    if (body.priority != null) update.priority = Number(body.priority);

    const { data, error } = await supabaseAdmin
      .from('coupon_automations')
      .update(update)
      .eq('id', id)
      .select('*, coupon:coupons(id, code, campaign_name, is_active)')
      .single();

    if (error) throw error;

    await logCouponAudit(supabaseAdmin, {
      action: body.is_active === false ? 'automation_paused' : body.is_active === true ? 'automation_activated' : 'automation_updated',
      actor_user_id: gate.userId,
      details: { automation_id: id, changes: update },
    });

    return NextResponse.json({ automation: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id } = await paramsPromise;
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { error } = await supabaseAdmin.from('coupon_automations').delete().eq('id', id);
    if (error) throw error;

    await logCouponAudit(supabaseAdmin, {
      action: 'automation_deleted',
      actor_user_id: gate.userId,
      details: { automation_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
