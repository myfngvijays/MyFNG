import {
  deleteMembershipPlan,
  migrationHintForPlanError,
  updateMembershipPlan,
} from '@/lib/membership-plans-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured', details: adminErr }, { status: 500 });
    }

    const body = await request.json();
    const { data, error } = await updateMembershipPlan(supabaseAdmin, id, body);

    if (error) {
      const hint = migrationHintForPlanError(error.message);
      return NextResponse.json({ error: 'Failed to update plan', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Plan updated successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured', details: adminErr }, { status: 500 });
    }

    const result = await deleteMembershipPlan(supabaseAdmin, id);
    if (result.error) {
      const err = result.error as { message?: string; hint?: string; code?: string };
      const status = err.code === 'PLAN_IN_USE' ? 409 : 500;
      return NextResponse.json(
        {
          error: status === 409 ? 'Cannot delete plan in use' : 'Failed to delete plan',
          details: err.message,
          hint: err.hint || (status === 409 ? undefined : MIGRATION_149_HINT),
        },
        { status },
      );
    }
    return NextResponse.json({ message: 'Plan deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
