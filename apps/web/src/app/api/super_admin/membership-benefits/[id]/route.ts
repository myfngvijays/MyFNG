import { MIGRATION_149_HINT, updateMembershipBenefit } from '@/lib/membership-plans-db';
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
    const { data, error } = await updateMembershipBenefit(supabaseAdmin, id, body);

    if (error) {
      const hint = /does not exist/i.test(error.message) ? MIGRATION_149_HINT : undefined;
      return NextResponse.json({ error: 'Failed to update benefit', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Benefit updated successfully' });
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

    const { error } = await supabaseAdmin.from('membership_benefits').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete benefit', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Benefit deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
