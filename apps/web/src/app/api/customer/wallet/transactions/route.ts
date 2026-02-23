import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  return NextResponse.json({ transactions: data || [] });
}

