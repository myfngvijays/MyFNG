import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { filterAppMembershipPlans, sortMembershipRows } from '@/lib/membership-plans-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { supabaseAdmin } = ctx;

  const { data: plans, error } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });

  const sortedPlans = sortMembershipRows(filterAppMembershipPlans(plans || []));

  const planIds = sortedPlans.map((p: any) => p.id);
  const { data: benefits } = planIds.length
    ? await supabaseAdmin
        .from('membership_benefits')
        .select('*')
        .in('plan_id', planIds)
        .order('created_at', { ascending: true })
    : { data: [] as any[] };

  const activeBenefits = [...(benefits || [])]
    .filter((b) => b.active !== false)
    .sort((a, b) => {
      const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

  return NextResponse.json({ plans: sortedPlans, benefits: activeBenefits });
}
