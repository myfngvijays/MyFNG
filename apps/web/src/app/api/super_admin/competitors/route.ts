import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireCompetitorIntelAccess } from '@/lib/super-admin-auth';
import { COMPETITOR_TABLES as T, isMissingTableError } from '@/lib/competitor-intel/types';

export const dynamic = 'force-dynamic';

function toSlug(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from(T.competitors)
      .select('*')
      .order('name');

    if (isMissingTableError(error)) {
      return NextResponse.json({ missing: true, competitors: [], error: 'Run database/371_competitor_intel.sql in Supabase SQL Editor.' });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const competitors = data || [];
    const ids = competitors.map((row: { id: string }) => row.id);
    let runs: any[] = [];
    let changeCounts: Record<string, number> = {};
    let gapCounts: Record<string, number> = {};

    if (ids.length) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [runRes, changeRes, gapRes] = await Promise.all([
        supabaseAdmin.from(T.runs).select('*').in('competitor_id', ids).order('started_at', { ascending: false }),
        supabaseAdmin.from(T.changes).select('competitor_id').in('competitor_id', ids).gte('detected_at', since),
        supabaseAdmin.from(T.aioGaps).select('competitor_id, status').in('competitor_id', ids).eq('status', 'open'),
      ]);
      runs = runRes.data || [];
      for (const row of changeRes.data || []) {
        changeCounts[row.competitor_id] = (changeCounts[row.competitor_id] || 0) + 1;
      }
      for (const row of gapRes.data || []) {
        gapCounts[row.competitor_id] = (gapCounts[row.competitor_id] || 0) + 1;
      }
    }

    const latestByComp = new Map<string, any>();
    for (const run of runs) {
      if (!latestByComp.has(run.competitor_id)) latestByComp.set(run.competitor_id, run);
    }

    return NextResponse.json({
      missing: false,
      competitors: competitors.map((row: any) => ({
        ...row,
        last_run: latestByComp.get(row.id) || null,
        changes_24h: changeCounts[row.id] || 0,
        open_aio_gaps: gapCounts[row.id] || 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load competitors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;
    if (auth.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can add competitors' }, { status: 403 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const websiteUrl = String(body.website_url || body.domain || '').trim();
    if (!name || !websiteUrl) {
      return NextResponse.json({ error: 'Name and website URL are required' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(websiteUrl.includes('://') ? websiteUrl : `https://${websiteUrl}`);
    } catch {
      return NextResponse.json({ error: 'Invalid website URL' }, { status: 400 });
    }

    const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const slug = toSlug(body.slug || name || domain);
    const { data, error } = await supabaseAdmin
      .from(T.competitors)
      .insert({
        slug,
        name,
        domain,
        website_url: `${parsed.protocol}//${parsed.host}`,
        notes: String(body.notes || '').trim() || null,
        seed_paths: Array.isArray(body.seed_paths) && body.seed_paths.length ? body.seed_paths : ['/'],
        active: true,
      })
      .select('*')
      .single();

    if (isMissingTableError(error)) {
      return NextResponse.json({ missing: true, error: 'Run database/371_competitor_intel.sql' }, { status: 503 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ competitor: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not add competitor' }, { status: 500 });
  }
}
