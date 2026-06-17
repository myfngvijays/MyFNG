import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PLANS = 'membership_plans';
const BENEFITS = 'membership_benefits';

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { data: plans, error } = await supabase
      .from(PLANS)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch plans', details: error.message }, { status: 500 });
    }

    const planIds = (plans || []).map((p: any) => p.id);
    const { data: benefits } = planIds.length
      ? await supabase.from(BENEFITS).select('*').in('plan_id', planIds).order('display_order', { ascending: true })
      : { data: [] as any[] };

    const benefitsByPlan: Record<string, any[]> = {};
    for (const b of benefits || []) {
      benefitsByPlan[b.plan_id] = benefitsByPlan[b.plan_id] || [];
      benefitsByPlan[b.plan_id].push(b);
    }

    const data = (plans || []).map((p: any) => ({ ...p, benefits: benefitsByPlan[p.id] || [] }));
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const name = String(body.name || '').trim();
    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(PLANS)
      .insert({
        code,
        name,
        description: body.description || null,
        price: Number(body.price) || 0,
        original_price: body.original_price != null ? Number(body.original_price) : null,
        tagline: body.tagline || null,
        badge: body.badge || 'MEMBERSHIP',
        period_label: body.period_label || '/ Year',
        duration_days: Number(body.duration_days) || 365,
        display_order: Number(body.display_order) || 0,
        footer_note: body.footer_note || null,
        second_car_addon_price: Number(body.second_car_addon_price) || 299,
        second_car_addon_title: body.second_car_addon_title || '2nd Car Add-On',
        second_car_addon_description: body.second_car_addon_description || null,
        second_car_addon_icon: body.second_car_addon_icon || 'car-sport',
        active: body.active !== undefined ? !!body.active : true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create plan', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Plan created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
