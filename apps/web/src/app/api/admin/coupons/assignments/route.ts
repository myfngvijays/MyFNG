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

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
    const limit = Math.min(Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 25)), 100);
    const search = (request.nextUrl.searchParams.get('search') || '').trim();
    const filter = (request.nextUrl.searchParams.get('filter') || '').toLowerCase(); // 'registered' | 'pending' | ''
    const couponId = (request.nextUrl.searchParams.get('coupon_id') || '').trim();
    const dateFrom = (request.nextUrl.searchParams.get('date_from') || '').trim();
    const dateTo = (request.nextUrl.searchParams.get('date_to') || '').trim();
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('customer_coupon_assignments')
      .select(`
        id,
        notes,
        expires_at,
        redeemed_at,
        created_at,
        pending_phone,
        customer:customers(id, full_name, phone, email),
        coupon:coupons(id, code, description, coupon_kind, discount_value, discount_mode, is_active)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filter === 'pending') {
      query = query.is('customer_id', null).not('pending_phone', 'is', null);
    } else if (filter === 'registered') {
      query = query.not('customer_id', 'is', null);
    }

    if (couponId) {
      query = query.eq('coupon_id', couponId);
    }

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`);
    }

    if (search) {
      query = query.or(`pending_phone.ilike.%${search}%,customer.phone.ilike.%${search}%,customer.full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    const { count: totalCount } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id', { count: 'exact', head: true });

    const { count: pendingCount } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id', { count: 'exact', head: true })
      .is('customer_id', null)
      .not('pending_phone', 'is', null);

    const { count: redeemedCount } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id', { count: 'exact', head: true })
      .not('redeemed_at', 'is', null);

    const { data: couponsData } = await supabaseAdmin
      .from('coupons')
      .select('id, code')
      .order('code');

    return NextResponse.json({
      assignments: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      counts: {
        total: totalCount || 0,
        registered: (totalCount || 0) - (pendingCount || 0),
        pending: pendingCount || 0,
        redeemed: redeemedCount || 0,
        open: (totalCount || 0) - (redeemedCount || 0),
      },
      coupons: couponsData || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const id = request.nextUrl.searchParams.get('id');
    const ids = request.nextUrl.searchParams.get('ids');
    const deleteIds = ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : id ? [id] : [];

    if (deleteIds.length === 0) return NextResponse.json({ error: 'Missing assignment id(s)' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .delete()
      .in('id', deleteIds);

    if (error) throw error;
    return NextResponse.json({ success: true, deleted: deleteIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
