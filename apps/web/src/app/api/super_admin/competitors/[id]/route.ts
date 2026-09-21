import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireCompetitorIntelAccess } from '@/lib/super-admin-auth';
import { COMPETITOR_TABLES as T, isMissingTableError } from '@/lib/competitor-intel/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { id } = await context.params;
    const { data: competitor, error } = await supabaseAdmin
      .from(T.competitors)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (isMissingTableError(error)) {
      return NextResponse.json({ missing: true, error: 'Run database/371_competitor_intel.sql' }, { status: 503 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [pagesRes, keywordsRes, changesRes, gapsRes, runsRes] = await Promise.all([
      supabaseAdmin.from(T.pages).select('*').eq('competitor_id', id).order('last_seen_at', { ascending: false }).limit(80),
      supabaseAdmin.from(T.keywords).select('*').eq('competitor_id', id).order('hit_count', { ascending: false }).limit(80),
      supabaseAdmin.from(T.changes).select('*').eq('competitor_id', id).gte('detected_at', since7).order('detected_at', { ascending: false }).limit(120),
      supabaseAdmin.from(T.aioGaps).select('*').eq('competitor_id', id).order('dimension'),
      supabaseAdmin.from(T.runs).select('*').eq('competitor_id', id).order('started_at', { ascending: false }).limit(8),
    ]);

    const pages = pagesRes.data || [];
    const changes = changesRes.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayChanges = changes.filter((row: { detected_at: string }) => String(row.detected_at || '').startsWith(today));

    return NextResponse.json({
      missing: false,
      competitor,
      last_run: runsRes.data?.[0] || null,
      runs: runsRes.data || [],
      pages,
      keywords: keywordsRes.data || [],
      changes,
      aio_gaps: gapsRes.data || [],
      stats: {
        pages: pages.length,
        keywords: (keywordsRes.data || []).length,
        changes_7d: changes.length,
        changes_today: todayChanges.length,
        open_aio_gaps: (gapsRes.data || []).filter((row: { status: string }) => row.status === 'open').length,
        new_pages_7d: changes.filter((row: { change_type: string }) => row.change_type === 'new_page').length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load competitor' }, { status: 500 });
  }
}
