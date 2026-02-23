import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data: active } = await supabaseAdmin
    .from('customer_memberships')
    .select('*, plan:membership_plans(*)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: usage } = await supabaseAdmin
    .from('membership_usage')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ membership: active || null, usage: usage || [] });
}

