import { createClient } from '@supabase/supabase-js';
import { filterAppMembershipPlans, sortMembershipRows } from '@/lib/membership-plans-db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getAdmin();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    let query = supabase
      .from('membership_plans')
      .select('*')
      .eq('active', true);

    let { data: plans, error } = await query.order('created_at', { ascending: true });

    if (error && /app_visible|membership_type|app_placements/i.test(error.message)) {
      ({ data: plans, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true }));
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch plans', details: error.message }, { status: 500 });
    }

    const visiblePlans = (plans || []).filter((p: any) => p.app_visible !== false);
    const sortedPlans = sortMembershipRows(filterAppMembershipPlans(visiblePlans));

    const planIds = sortedPlans.map((p: any) => p.id);
    const { data: benefits } = planIds.length
      ? await supabase
          .from('membership_benefits')
          .select('*')
          .in('plan_id', planIds)
          .order('created_at', { ascending: true })
      : { data: [] as any[] };

    const sortedBenefits = [...(benefits || [])]
      .filter((b) => b.active !== false)
      .sort((a, b) => {
        const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });

    const benefitsByPlan: Record<string, any[]> = {};
    for (const b of sortedBenefits) {
      benefitsByPlan[b.plan_id] = benefitsByPlan[b.plan_id] || [];
      benefitsByPlan[b.plan_id].push(b);
    }

    const data = sortedPlans.map((p: any) => ({ ...p, benefits: benefitsByPlan[p.id] || [] }));
    return NextResponse.json({ plans: data });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
