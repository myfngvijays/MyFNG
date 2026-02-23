import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletAccount, logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
  const { data: recent } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, transaction_type, amount, source, created_at, balance_after')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ wallet, transactions: recent || [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const amount = Number(body.amount || 0);
  const source = String(body.source || 'MANUAL_ADMIN');
  const sourceRefId = body.source_ref_id || null;
  const transactionType = String(body.transaction_type || 'CREDIT');
  const idemKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!['CREDIT', 'DEBIT'].includes(transactionType)) {
    return NextResponse.json({ error: 'transaction_type must be CREDIT or DEBIT' }, { status: 400 });
  }

  const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
  const current = Number(wallet.current_balance || 0);
  const nextBalance = transactionType === 'CREDIT' ? current + amount : current - amount;
  if (nextBalance < 0) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
  }

  const txPayload = {
    wallet_account_id: wallet.id,
    customer_id: customer.id,
    transaction_type: transactionType,
    amount,
    balance_after: nextBalance,
    source,
    source_ref_id: sourceRefId,
    idempotency_key: idemKey,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };

  const { error: txError } = await supabaseAdmin.from('wallet_transactions').insert(txPayload);
  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    current_balance: nextBalance,
    updated_at: new Date().toISOString(),
  };
  if (transactionType === 'CREDIT') {
    updatePayload.lifetime_credited = Number(wallet.lifetime_credited || 0) + amount;
  } else {
    updatePayload.lifetime_debited = Number(wallet.lifetime_debited || 0) + amount;
  }
  await supabaseAdmin.from('wallet_accounts').update(updatePayload).eq('id', wallet.id);
  await logCustomerEvent(supabaseAdmin, customer.id, 'wallet_transaction', 'wallet', { amount, transactionType, source });

  return NextResponse.json({ success: true, balance: nextBalance });
}

