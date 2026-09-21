import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireCompetitorIntelAccess } from '@/lib/super-admin-auth';
import { COMPETITOR_TABLES as T, isMissingTableError } from '@/lib/competitor-intel/types';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const gapId = String(body.id || body.gap_id || '').trim();
    const status = String(body.status || '').trim();
    if (!gapId || !['open', 'covered', 'ignored'].includes(status)) {
      return NextResponse.json({ error: 'id and status (open|covered|ignored) are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(T.aioGaps)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', gapId)
      .eq('competitor_id', id)
      .select('*')
      .single();

    if (isMissingTableError(error)) {
      return NextResponse.json({ missing: true, error: 'Run database/371_competitor_intel.sql' }, { status: 503 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ gap: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not update gap' }, { status: 500 });
  }
}
