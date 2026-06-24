import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { parseWalletPlatform } from '@/lib/wallet-config';
import { getWalletSummary, computeWalletRewardTotals } from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const headerStore = await headers();
  const platform = parseWalletPlatform(
    headerStore.get('x-app-platform') || headerStore.get('X-App-Platform'),
  );

  const summary = await getWalletSummary(supabaseAdmin, customer.id, platform);
  const totals = await computeWalletRewardTotals(supabaseAdmin, customer.id);
  const { data: recent } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, transaction_type, amount, source, created_at, balance_after, metadata, expires_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    wallet: {
      ...summary.wallet,
      spendable_balance: summary.spendable_balance,
      welcome_bonus_expires_at: summary.welcome_bonus_expires_at,
    },
    rules: summary.rules,
    totals,
    transactions: recent || [],
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  return NextResponse.json({ error: 'Manual wallet adjustments are disabled' }, { status: 403 });
}
