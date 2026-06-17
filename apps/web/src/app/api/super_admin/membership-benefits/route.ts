import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const planId = String(body.plan_id || '');
    const title = String(body.title || '').trim();
    if (!planId || !title) {
      return NextResponse.json({ error: 'plan_id and title are required' }, { status: 400 });
    }

    const benefitCode = String(body.benefit_code || title).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 50);

    const { data, error } = await supabase
      .from('membership_benefits')
      .insert({
        plan_id: planId,
        benefit_code: benefitCode,
        title,
        description: body.description || null,
        icon: body.icon || null,
        icon_url: body.icon_url || null,
        display_order: Number(body.display_order) || 0,
        active: body.active !== undefined ? !!body.active : true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create benefit', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Benefit created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
