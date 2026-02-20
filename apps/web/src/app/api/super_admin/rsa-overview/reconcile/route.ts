import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = String((userData as any).roles?.role_code || '').trim();
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

async function fetchCapturedPaymentForOrder(orderId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
  });
  if (!response.ok) return null;
  const json = await response.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];
  const captured = items.find((item: any) => {
    const status = String(item?.status || '').toLowerCase();
    return status === 'captured' || status === 'authorized';
  });
  return captured || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay credentials are not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days || 30), 1), 180);
    const limit = Math.min(Math.max(Number(body?.limit || 500), 1), 5000);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { data: staleRows, error } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('order_id, status, amount, amount_paise, currency')
      .gte('created_at', since)
      .in('status', ['CREATED', 'LINK_GENERATED'])
      .like('order_id', 'order_%')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load stale rows' }, { status: 500 });
    }

    const rows = Array.isArray(staleRows) ? staleRows : [];
    let updated = 0;
    let noCapture = 0;
    let failed = 0;
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      const orderId = String(row?.order_id || '').trim();
      if (!orderId) continue;
      try {
        const captured = await fetchCapturedPaymentForOrder(orderId);
        if (!captured?.id) {
          noCapture += 1;
          continue;
        }

        await db
          .from('Razorpay_Direct_pay_RSA')
          .update({
            payment_id: String(captured.id),
            amount: Number.isFinite(Number(captured.amount)) ? Number(captured.amount) / 100 : row?.amount ?? null,
            amount_paise: Number.isFinite(Number(captured.amount)) ? Number(captured.amount) : row?.amount_paise ?? null,
            currency: String(captured.currency || row?.currency || 'INR'),
            status: 'SUCCESS',
            razorpay_payload: captured,
            updated_at: nowIso,
          })
          .eq('order_id', orderId);

        updated += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json(
      {
        success: true,
        scanned: rows.length,
        updated,
        no_capture: noCapture,
        failed,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

