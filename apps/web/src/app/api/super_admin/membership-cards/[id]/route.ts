import { buildMembershipCardUpdatePayload, migrationHintForCardError } from '@/lib/membership-cards-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'membership_cards';

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
    const updates = buildMembershipCardUpdatePayload(body);
    const { data, error } = await supabaseAdmin.from(TABLE).update(updates).eq('id', id).select().single();

    if (error) {
      const hint = migrationHintForCardError(error.message);
      return NextResponse.json({ error: 'Failed to update card', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Card updated successfully' });
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

    const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id);
    if (error) {
      const hint = migrationHintForCardError(error.message);
      return NextResponse.json({ error: 'Failed to delete card', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ message: 'Card deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
