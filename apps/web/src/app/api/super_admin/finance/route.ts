/**
 * GET /api/super_admin/finance
 * Finance overview: revenue (today, month), pending payouts, pending refunds
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function assertSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401 as const, error: 'Unauthorized', user: null };
  }
  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  if (roleError || !userData) {
    return { ok: false, status: 403 as const, error: 'Forbidden', user };
  }
  const roleCode = (userData as { roles?: { role_code: string } })?.roles?.role_code ?? null;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403 as const, error: 'Forbidden', user };
  }
  return { ok: true, status: 200 as const, error: null, user };
}

function startOfTodayISO() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const utcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0);
  return new Date(utcMs - istOffset).toISOString();
}

function startOfMonthISO() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const utcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0);
  return new Date(utcMs - istOffset).toISOString();
}

function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: adminError || 'Admin client not configured' },
        { status: 500 }
      );
    }
    const db = supabaseAdmin as any;

    const todayStart = startOfTodayISO();
    const monthStart = startOfMonthISO();

    const [paidToday, paidThisMonth, payoutsRes, refundsRes] = await Promise.all([
      db.from('invoices').select('paid_amount, final_amount').eq('payment_status', 'PAID').gte('paid_at', todayStart),
      db.from('invoices').select('paid_amount, final_amount').eq('payment_status', 'PAID').gte('paid_at', monthStart),
      db.from('workshop_payouts').select('*, workshop:workshops(name)').eq('status', 'PENDING').order('created_at', { ascending: false }),
      db.from('refund_requests').select('*, lead:service_leads(customer_name)').eq('status', 'PENDING').order('created_at', { ascending: false }),
    ]);

    const todayRevenue = (paidToday.data || []).reduce((s: number, inv: any) => s + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0), 0);
    const monthlyRevenue = (paidThisMonth.data || []).reduce((s: number, inv: any) => s + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0), 0);

    const payouts = (payoutsRes.data || []).map((p: any) => ({
      ...p,
      workshop: p.workshop ?? { name: null },
    }));
    const refunds = (refundsRes.data || []).map((r: any) => ({
      ...r,
      lead: r.lead ?? { customer_name: null },
    }));

    const pendingPayoutsAmount = payouts.reduce((s: number, p: any) => s + safeNum(p.amount), 0);
    const pendingRefundsAmount = refunds.reduce((s: number, r: any) => s + safeNum(r.amount), 0);

    return NextResponse.json({
      stats: {
        todayRevenue,
        monthlyRevenue,
        pendingPayouts: payouts.length,
        pendingPayoutsAmount,
        pendingRefunds: refunds.length,
        pendingRefundsAmount,
      },
      payouts,
      refunds,
    });
  } catch (error) {
    console.error('Error in GET /api/super_admin/finance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
