import {
  buildMembershipTermUpdate,
  mapMembershipTermRow,
  MEMBERSHIP_TERMS_TABLE,
  migrationHintForMembershipTermsError,
  MIGRATION_227_HINT,
} from '@/lib/membership-terms-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const updates = buildMembershipTermUpdate(body);
    if (body.body !== undefined && !String(body.body || '').trim()) {
      return NextResponse.json({ error: 'Term text is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(MEMBERSHIP_TERMS_TABLE)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update term', details: error.message, hint: migrationHintForMembershipTermsError(error.message) || MIGRATION_227_HINT },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: mapMembershipTermRow(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { error } = await supabaseAdmin.from(MEMBERSHIP_TERMS_TABLE).delete().eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete term', details: error.message, hint: MIGRATION_227_HINT },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
