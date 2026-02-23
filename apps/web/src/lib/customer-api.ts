import { NextResponse } from 'next/server';
import { getCustomerFromSession } from '@/lib/customer-session';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export async function requireCustomer() {
  const { customer } = await getCustomerFromSession();
  if (!customer) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { response: NextResponse.json({ error: 'Server config error' }, { status: 500 }) };
  }
  return { customer, supabaseAdmin };
}

export async function ensureWalletAccount(supabaseAdmin: any, customerId: string) {
  const { data: existing } = await supabaseAdmin
    .from('wallet_accounts')
    .select('id, current_balance')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('wallet_accounts')
    .insert({ customer_id: customerId, current_balance: 0 })
    .select('id, current_balance')
    .single();
  if (error || !data) throw new Error('Failed to create wallet account');
  return data;
}

export async function logCustomerEvent(
  supabaseAdmin: any,
  customerId: string | null,
  event_name: string,
  event_group: string,
  properties: Record<string, unknown> = {}
) {
  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: customerId,
    event_name,
    event_group,
    properties,
  });
}

