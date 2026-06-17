import { createClient } from '@supabase/supabase-js';
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

    const { data: plans, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch plans', details: error.message }, { status: 500 });
    }

    const planIds = (plans || []).map((p: any) => p.id);
    const { data: benefits } = planIds.length
      ? await supabase
          .from('membership_benefits')
          .select('*')
          .in('plan_id', planIds)
          .eq('active', true)
          .order('display_order', { ascending: true })
      : { data: [] as any[] };

    const benefitsByPlan: Record<string, any[]> = {};
    for (const b of benefits || []) {
      benefitsByPlan[b.plan_id] = benefitsByPlan[b.plan_id] || [];
      benefitsByPlan[b.plan_id].push(b);
    }

    const data = (plans || []).map((p: any) => ({ ...p, benefits: benefitsByPlan[p.id] || [] }));
    return NextResponse.json({ plans: data });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
