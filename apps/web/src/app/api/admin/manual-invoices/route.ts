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

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(String(url.searchParams.get('page') || '1'), 10) || 1);
    const pageSize = Math.min(500, Math.max(10, parseInt(String(url.searchParams.get('pageSize') || '25'), 10) || 25));
    const fromDate = url.searchParams.get('fromDate')?.trim() || null;
    const toDate = url.searchParams.get('toDate')?.trim() || null;

    const from = fromDate ? `${fromDate}T00:00:00.000Z` : null;
    const to = toDate ? `${toDate}T23:59:59.999Z` : null;

    let query = supabaseAdmin
      .from('manual_create_invoice')
      .select('id, invoice_number, customer_name, customer_phone, total_amount, currency, status, created_at, payment_mode, payment_reference, paid_at, customer_gstin, car_number, car_model', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const offset = (page - 1) * pageSize;
    const { data, error, count } = await query.range(offset, offset + pageSize - 1);

    if (error) throw error;
    const total = count ?? (data?.length ?? 0);
    return NextResponse.json({
      invoices: data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

