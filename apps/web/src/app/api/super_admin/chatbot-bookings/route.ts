import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const status = String(searchParams.get('status') || 'ALL').trim().toLowerCase();
    const limit = Math.min(Number(searchParams.get('limit') || 200), 500);

    let query = supabaseAdmin
      .from('chatbot_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 200);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        [
          `customer_name.ilike.%${search}%`,
          `phone_number.ilike.%${search}%`,
          `car_model.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `service_name.ilike.%${search}%`,
          `service_category.ilike.%${search}%`,
        ].join(',')
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch AI chatbot bookings' }, { status: 500 });
    }

    return NextResponse.json({ bookings: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

