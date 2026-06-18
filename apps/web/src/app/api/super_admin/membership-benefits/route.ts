import { insertMembershipBenefit, MIGRATION_149_HINT } from '@/lib/membership-plans-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured', details: adminErr }, { status: 500 });
    }

    const body = await request.json();
    const planId = String(body.plan_id || '');
    const title = String(body.title || '').trim();
    if (!planId || !title) {
      return NextResponse.json({ error: 'plan_id and title are required' }, { status: 400 });
    }

    const { data, error } = await insertMembershipBenefit(supabaseAdmin, body);

    if (error) {
      const hint = /does not exist/i.test(error.message) ? MIGRATION_149_HINT : undefined;
      return NextResponse.json({ error: 'Failed to create benefit', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Benefit created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
