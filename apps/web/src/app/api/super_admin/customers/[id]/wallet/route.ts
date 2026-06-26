import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { creditWallet, debitWallet } from '@/lib/wallet-service';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
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
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true, status: 200, error: null, user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { id: customerId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'credit').trim().toLowerCase();
    const amount = Number(body.amount);
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!['credit', 'debit'].includes(action)) {
      return NextResponse.json({ error: 'action must be credit or debit' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount greater than 0' }, { status: 400 });
    }
    if (amount > 100000) {
      return NextResponse.json({ error: 'Maximum amount per transaction is ₹1,00,000' }, { status: 400 });
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const adminUserId = auth.user?.id || 'unknown';

    if (action === 'debit') {
      const idempotencyKey = `admin-debit:${customerId}:${adminUserId}:${randomUUID()}`;
      const label = note || 'Admin wallet debit';

      const result = await debitWallet(supabaseAdmin, customerId, amount, {
        source: 'ADMIN_DEBIT',
        idempotencyKey,
        metadata: {
          label,
          admin_user_id: adminUserId,
          admin_note: note || null,
        },
      });

      await supabaseAdmin.from('customer_analytics_events').insert({
        customer_id: customerId,
        event_name: 'wallet_admin_debit',
        event_group: 'wallet',
        properties: {
          amount: result.debited,
          balance_after: result.balance_after,
          admin_user_id: adminUserId,
          note: note || null,
          duplicate: result.duplicate,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'debit',
        debited: result.debited,
        balance_after: result.balance_after,
        duplicate: result.duplicate,
      });
    }

    const idempotencyKey = `admin-credit:${customerId}:${adminUserId}:${randomUUID()}`;
    const label = note || 'Admin wallet credit';

    const result = await creditWallet(supabaseAdmin, customerId, amount, {
      source: 'ADMIN_CREDIT',
      idempotencyKey,
      metadata: {
        label,
        admin_user_id: adminUserId,
        admin_note: note || null,
      },
    });

    await supabaseAdmin.from('customer_analytics_events').insert({
      customer_id: customerId,
      event_name: 'wallet_admin_credit',
      event_group: 'wallet',
      properties: {
        amount: result.credited,
        balance_after: result.balance_after,
        admin_user_id: adminUserId,
        note: note || null,
        duplicate: result.duplicate,
      },
    });

    return NextResponse.json({
      success: true,
      action: 'credit',
      credited: result.credited,
      balance_after: result.balance_after,
      duplicate: result.duplicate,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
