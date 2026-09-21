import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireCompetitorIntelAccess } from '@/lib/super-admin-auth';
import { COMPETITOR_TABLES as T, isMissingTableError } from '@/lib/competitor-intel/types';
import { competitorPageKey, loosePath, sameCompetitorPage } from '@/lib/competitor-intel/extract';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { id } = await context.params;
    const focusUrl = String(request.nextUrl.searchParams.get('url') || '').trim();
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
    const focusKey = focusUrl ? competitorPageKey(focusUrl) : null;
    const focusPaths = focusKey
      ? Array.from(new Set([
        focusKey.path,
        focusKey.pathLower,
        focusKey.path === '/' ? '/' : `${focusKey.path}/`,
        focusKey.pathLower === '/' ? '/' : `${focusKey.pathLower}/`,
      ]))
      : [];

    const [pagesRes, keywordsRes, changesRes, gapsRes, runsRes, focusPagesRes] = await Promise.all([
      supabaseAdmin.from(T.pages).select('*').eq('competitor_id', id).order('last_seen_at', { ascending: false }).limit(80),
      supabaseAdmin.from(T.keywords).select('*').eq('competitor_id', id).order('hit_count', { ascending: false }).limit(80),
      supabaseAdmin.from(T.changes).select('*').eq('competitor_id', id).gte('detected_at', since7).order('detected_at', { ascending: false }).limit(120),
      supabaseAdmin.from(T.aioGaps).select('*').eq('competitor_id', id).order('dimension'),
      supabaseAdmin.from(T.runs).select('*').eq('competitor_id', id).order('started_at', { ascending: false }).limit(8),
      focusPaths.length
        ? supabaseAdmin.from(T.pages).select('*').eq('competitor_id', id).in('path', focusPaths)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    let pages = pagesRes.data || [];
    let keywords = keywordsRes.data || [];
    let changes = changesRes.data || [];
    let aioGaps = gapsRes.data || [];
    const slug = focusKey ? loosePath(focusKey.path).replace(/^\//, '') : '';
    const slugPages = slug
      ? (await supabaseAdmin.from(T.pages).select('*').eq('competitor_id', id).ilike('path', `%${slug}%`).limit(8)).data || []
      : [];
    const candidates = [...(focusPagesRes.data || []), ...slugPages, ...pages];
    let focusPage = candidates.find((row: { url?: string; path?: string }) => sameCompetitorPage(row.url, focusUrl) || sameCompetitorPage(row.path, focusUrl))
      || slugPages.find((row: { path?: string }) => loosePath(row.path || '') === loosePath(focusKey?.path || ''))
      || slugPages[0]
      || (focusPagesRes.data || [])[0]
      || null;

    if (focusUrl) {
      if (focusPage) {
        const [pageChanges, pageKeywords] = await Promise.all([
          supabaseAdmin
            .from(T.changes)
            .select('*')
            .eq('competitor_id', id)
            .eq('page_id', focusPage.id)
            .order('detected_at', { ascending: false })
            .limit(80),
          supabaseAdmin
            .from(T.keywords)
            .select('*')
            .eq('competitor_id', id)
            .eq('source_url', focusPage.url)
            .order('hit_count', { ascending: false })
            .limit(80),
        ]);
        const fromPage = (focusPage.keywords || []).map((word: string, index: number) => ({
          id: `page-kw-${index}`,
          keyword: word,
          hit_count: 1,
          source_url: focusPage.url,
        }));
        const fromDb = pageKeywords.data || [];
        const seenKw = new Set<string>();
        keywords = [...fromPage, ...fromDb].filter((row: { keyword: string }) => {
          const key = String(row.keyword || '').toLowerCase();
          if (!key || seenKw.has(key)) return false;
          seenKw.add(key);
          return true;
        });
        const claimDims = new Set((focusPage.aio_claims || []).map((claim: { dimension?: string }) => claim.dimension));
        pages = [focusPage];
        changes = pageChanges.data?.length
          ? pageChanges.data
          : changes.filter((row: { url?: string; page_id?: string }) => row.page_id === focusPage.id || sameCompetitorPage(row.url, focusPage.url));
        aioGaps = aioGaps.filter((row: { dimension: string }) => claimDims.has(row.dimension));
      } else {
        pages = [];
        keywords = [];
        changes = [];
        aioGaps = [];
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayChanges = changes.filter((row: { detected_at: string }) => String(row.detected_at || '').startsWith(today));

    return NextResponse.json({
      missing: false,
      competitor,
      last_run: runsRes.data?.[0] || null,
      runs: runsRes.data || [],
      pages,
      keywords,
      changes,
      aio_gaps: aioGaps,
      focus: focusUrl
        ? { url: focusPage?.url || focusUrl, path: focusPage?.path || focusKey?.path, found: Boolean(focusPage) }
        : null,
      stats: {
        pages: pages.length,
        keywords: keywords.length,
        changes_7d: changes.length,
        changes_today: todayChanges.length,
        open_aio_gaps: aioGaps.filter((row: { status: string }) => row.status === 'open').length,
        new_pages_7d: changes.filter((row: { change_type: string }) => row.change_type === 'new_page').length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load competitor' }, { status: 500 });
  }
}
