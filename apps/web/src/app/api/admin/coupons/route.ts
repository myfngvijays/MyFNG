import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const withCounts = await Promise.all(
      (coupons || []).map(async (coupon: any) => {
        const { count } = await supabaseAdmin
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id);
        return { ...coupon, usage_count: count || 0 };
      })
    );

    return NextResponse.json({ coupons: withCounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const payload = {
      code: String(body?.code || '').trim(),
      coupon_kind: String(body?.coupon_kind || '').trim(),
      discount_mode: body?.discount_mode ? String(body.discount_mode).trim() : null,
      discount_value: body?.discount_value != null ? Number(body.discount_value) : null,
      min_order_value: body?.min_order_value != null ? Number(body.min_order_value) : null,
      target_service_type_id: body?.target_service_type_id || null,
      target_subservice_id: body?.target_subservice_id || null,
      target_custom_label: body?.target_custom_label || null,
      start_at: body?.start_at || null,
      end_at: body?.end_at || null,
      usage_limit_total: body?.usage_limit_total != null ? Number(body.usage_limit_total) : null,
      usage_limit_per_customer: body?.usage_limit_per_customer != null ? Number(body.usage_limit_per_customer) : null,
      is_active: body?.is_active ?? true,
      description: body?.description || null,
      applicable_city_ids: body?.applicable_city_ids || null,
      applicable_workshop_ids: body?.applicable_workshop_ids || null,
      applicable_service_type_ids: body?.applicable_service_type_ids || null,
    };

    if (!payload.code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }
    if (!payload.coupon_kind) {
      return NextResponse.json({ error: 'Coupon type is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ coupon: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
