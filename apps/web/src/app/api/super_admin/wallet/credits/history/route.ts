import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertWalletAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userData as { roles?: { role_code?: string } })?.roles?.role_code;
  if (roleError || !userData || !['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertWalletAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const limit = Math.min(
      200,
      Math.max(10, Number(new URL(request.url).searchParams.get('limit') || 100)),
    );
    const search = String(new URL(request.url).searchParams.get('q') || '')
      .trim()
      .toLowerCase();
    const batchFilter = String(new URL(request.url).searchParams.get('batch') || '').trim();

    let query = supabaseAdmin
      .from('wallet_transactions')
      .select(
        'id, customer_id, amount, balance_after, source, metadata, created_at, customers(full_name, phone)',
      )
      .in('source', ['ADMIN_CREDIT', 'ADMIN_DEBIT'])
      .in('transaction_type', ['CREDIT', 'DEBIT'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (batchFilter) {
      query = query.contains('metadata', { bulk_batch_id: batchFilter });
    }

    const { data: transactions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (transactions || [])
      .map((row: any) => ({
        id: row.id,
        customer_id: row.customer_id,
        customer_name: row.customers?.full_name || null,
        phone: row.customers?.phone || null,
        amount: Number(row.amount || 0),
        balance_after: Number(row.balance_after || 0),
        source: row.source,
        transaction_type: row.transaction_type,
        label: row.metadata?.label || (row.source === 'ADMIN_DEBIT' ? 'Admin debit' : 'Admin credit'),
        campaign_label: row.metadata?.campaign_label || null,
        bulk_batch_id: row.metadata?.bulk_batch_id || null,
        admin_note: row.metadata?.admin_note || null,
        created_at: row.created_at,
      }))
      .filter((row) => {
        if (!search) return true;
        const hay = [row.customer_name, row.phone, row.label, row.campaign_label, row.bulk_batch_id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      });

    const bulkBatches = new Map<
      string,
      { batch_id: string; campaign_label: string | null; total_amount: number; user_count: number; created_at: string }
    >();

    for (const row of rows) {
      if (!row.bulk_batch_id) continue;
      const existing = bulkBatches.get(row.bulk_batch_id);
      if (existing) {
        existing.total_amount += row.amount;
        existing.user_count += 1;
        if (row.created_at > existing.created_at) existing.created_at = row.created_at;
      } else {
        bulkBatches.set(row.bulk_batch_id, {
          batch_id: row.bulk_batch_id,
          campaign_label: row.campaign_label,
          total_amount: row.amount,
          user_count: 1,
          created_at: row.created_at,
        });
      }
    }

    return NextResponse.json({
      transactions: rows,
      bulk_batches: [...bulkBatches.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
