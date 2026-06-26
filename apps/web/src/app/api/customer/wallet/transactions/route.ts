import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { filterVisibleWalletTransactions } from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data: transactions } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, transaction_type, amount, source, created_at, balance_after, metadata, expires_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json({ transactions: filterVisibleWalletTransactions(transactions || []) });
}
