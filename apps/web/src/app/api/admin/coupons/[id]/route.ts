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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { id: rawId } = await params;
    const id = String(rawId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing coupon id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const payload: any = {
      code: body?.code != null ? String(body.code).trim() : undefined,
      coupon_kind: body?.coupon_kind != null ? String(body.coupon_kind).trim() : undefined,
      discount_mode: body?.discount_mode != null ? String(body.discount_mode).trim() : null,
      discount_value: body?.discount_value != null ? Number(body.discount_value) : null,
      min_order_value: body?.min_order_value != null ? Number(body.min_order_value) : null,
      target_service_type_id: body?.target_service_type_id ?? null,
      target_subservice_id: body?.target_subservice_id ?? null,
      target_custom_label: body?.target_custom_label ?? null,
      start_at: body?.start_at ?? null,
      end_at: body?.end_at ?? null,
      usage_limit_total: body?.usage_limit_total != null ? Number(body.usage_limit_total) : null,
      usage_limit_per_customer: body?.usage_limit_per_customer != null ? Number(body.usage_limit_per_customer) : null,
      is_active: body?.is_active ?? undefined,
      description: body?.description ?? null,
      applicable_city_ids: body?.applicable_city_ids ?? null,
      applicable_workshop_ids: body?.applicable_workshop_ids ?? null,
      applicable_service_type_ids: body?.applicable_service_type_ids ?? null,
      campaign_name: body?.campaign_name ?? null,
      applicable_channels: body?.applicable_channels ?? undefined,
      max_discount_amount: body?.max_discount_amount != null ? Number(body.max_discount_amount) : null,
      first_order_only: body?.first_order_only ?? undefined,
      is_public: body?.is_public ?? undefined,
    };

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCouponAudit(supabaseAdmin, {
      coupon_id: id,
      action: 'UPDATE',
      actor_user_id: gate.userId,
      details: payload,
    });
    return NextResponse.json({ coupon: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
