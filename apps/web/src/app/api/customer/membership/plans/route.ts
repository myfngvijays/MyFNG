import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { supabaseAdmin } = ctx;

  const { data: plans, error } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });

  const planIds = (plans || []).map((p: any) => p.id);
  const { data: benefits } = planIds.length
    ? await supabaseAdmin
        .from('membership_benefits')
        .select('*')
        .in('plan_id', planIds)
        .eq('active', true)
        .order('display_order', { ascending: true })
    : { data: [] as any[] };

  return NextResponse.json({ plans: plans || [], benefits: benefits || [] });
}
