import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function digits10(input: unknown) {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '').toUpperCase();
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: leads, error: leadsError } = await db
      .from('rsa_leads')
      .select(
        'id, customer_name, contact_number, vehicle_number, vehicle_model, lead_status, complaint_status, assigned_manager_id, lead_registered_at, requested_at'
      )
      .eq('assigned_manager_id', profile.id)
      .order('lead_registered_at', { ascending: false })
      .limit(2000);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message || 'Failed to fetch assigned leads' }, { status: 500 });
    }

    const leadByPhone = new Map<string, any>();
    for (const lead of leads || []) {
      const phone = digits10((lead as any)?.contact_number);
      if (!phone || leadByPhone.has(phone)) continue;
      leadByPhone.set(phone, lead);
    }

    if (leadByPhone.size === 0) {
      return NextResponse.json({ success: true, payments: [], total_amount: 0, total_count: 0 }, { status: 200 });
    }

    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: paymentRows, error: paymentsError } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('order_id, payment_id, amount, amount_paise, currency, status, customer_name, customer_phone, razorpay_payload, created_at, updated_at')
      .gte('created_at', since)
      .in('status', ['SUCCESS', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'])
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message || 'Failed to fetch Razorpay payments' }, { status: 500 });
    }

    const payments = (paymentRows || [])
      .map((row: any) => {
        const phone = digits10(row?.customer_phone);
        const lead = phone ? leadByPhone.get(phone) : null;
        if (!lead) return null;
        const payload = row?.razorpay_payload && typeof row.razorpay_payload === 'object' ? row.razorpay_payload : {};
        const amount =
          row?.amount != null
            ? Number(row.amount)
            : row?.amount_paise != null
              ? Number(row.amount_paise) / 100
              : null;
        const capturedPaise = Number(payload?.amount_captured || row?.amount_paise || 0);
        const refundedPaise = Number(payload?.amount_refunded || 0);
        const refundStatus =
          String(row?.status || '').toUpperCase() === 'REFUNDED'
            ? 'REFUNDED'
            : String(row?.status || '').toUpperCase() === 'PARTIALLY_REFUNDED'
              ? 'PARTIALLY_REFUNDED'
              : refundedPaise > 0
                ? (capturedPaise > 0 && refundedPaise >= capturedPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED')
                : 'NOT_REFUNDED';
        return {
          lead_id: lead?.id || null,
          lead_customer_name: lead?.customer_name || null,
          lead_phone: lead?.contact_number || null,
          vehicle_number: lead?.vehicle_number || null,
          vehicle_model: lead?.vehicle_model || null,
          lead_status: lead?.lead_status || lead?.complaint_status || null,
          order_id: row?.order_id || null,
          payment_id: row?.payment_id || null,
          amount: Number.isFinite(amount as number) ? Number(amount) : null,
          currency: row?.currency || 'INR',
          status: row?.status || null,
          refund_status: refundStatus,
          refunded_amount: refundedPaise > 0 ? refundedPaise / 100 : 0,
          method: payload?.method || null,
          customer_name: row?.customer_name || null,
          customer_phone: row?.customer_phone || null,
          created_at: row?.created_at || null,
          updated_at: row?.updated_at || null,
        };
      })
      .filter(Boolean);

    const totalAmount = payments.reduce((sum: number, row: any) => {
      const value = Number(row?.amount || 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    return NextResponse.json(
      {
        success: true,
        payments,
        total_amount: totalAmount,
        total_count: payments.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
