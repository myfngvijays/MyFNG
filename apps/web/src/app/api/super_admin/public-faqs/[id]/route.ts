import {
  buildPublicFaqUpdate,
  mapPublicFaqRow,
  migrationHintForPublicFaqsError,
  MIGRATION_229_HINT,
  PUBLIC_FAQS_TABLE,
} from '@/lib/public-faqs-db';
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
    const updates = buildPublicFaqUpdate(body);
    if (body.question !== undefined && !String(body.question || '').trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }
    if (body.answer !== undefined && !String(body.answer || '').trim()) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(PUBLIC_FAQS_TABLE)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to update FAQ',
          details: error.message,
          hint: migrationHintForPublicFaqsError(error.message) || MIGRATION_229_HINT,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: mapPublicFaqRow(data) });
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

    const { error } = await supabaseAdmin.from(PUBLIC_FAQS_TABLE).delete().eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete FAQ', details: error.message, hint: MIGRATION_229_HINT },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
