import {
  insertMembershipPlan,
  migrationHintForPlanError,
  sortMembershipRows,
} from '@/lib/membership-plans-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requirePanelAccess, requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PLANS = 'membership_plans';
const BENEFITS = 'membership_benefits';

async function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      db: null,
      res: NextResponse.json({ error: 'Database not configured', details: error }, { status: 500 }),
    };
  }
  return { db: supabaseAdmin, res: null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requirePanelAccess(supabase, 'appCustomers');
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const { data: plans, error } = await db.from(PLANS).select('*').order('created_at', { ascending: true });

    if (error) {
      const hint = migrationHintForPlanError(error.message);
      return NextResponse.json({ error: 'Failed to fetch plans', details: error.message, hint }, { status: 500 });
    }

    const planIds = (plans || []).map((p: any) => p.id);
    const { data: benefits, error: benefitsError } = planIds.length
      ? await db.from(BENEFITS).select('*').in('plan_id', planIds).order('created_at', { ascending: true })
      : { data: [] as any[], error: null };

    if (benefitsError) {
      const hint = migrationHintForPlanError(benefitsError.message);
      return NextResponse.json({ error: 'Failed to fetch benefits', details: benefitsError.message, hint }, { status: 500 });
    }

    const benefitsByPlan: Record<string, any[]> = {};
    for (const b of sortMembershipRows(benefits || [])) {
      benefitsByPlan[b.plan_id] = benefitsByPlan[b.plan_id] || [];
      benefitsByPlan[b.plan_id].push(b);
    }

    const data = sortMembershipRows(plans || []).map((p: any) => ({
      ...p,
      benefits: benefitsByPlan[p.id] || [],
      legacy: ['BRONZE', 'SILVER', 'GOLD'].includes(String(p.code || '').toUpperCase()),
    }));
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

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json();
    const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const name = String(body.name || '').trim();
    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const { data, error } = await insertMembershipPlan(db, body);

    if (error) {
      const hint =
        migrationHintForPlanError(error.message) ||
        (/duplicate key|unique/i.test(error.message) ? 'A plan with this code already exists.' : undefined);
      return NextResponse.json({ error: 'Failed to create plan', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Plan created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
