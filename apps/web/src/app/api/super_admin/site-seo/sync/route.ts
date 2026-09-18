import { SITE_PAGE_SEO_TABLE, migrationHintForSitePageSeoError, MIGRATION_269_HINT } from '@/lib/site-page-seo';
import { syncSitePageSeoPaths, type SeoPathSyncScope } from '@/lib/site-page-seo-sync';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { revalidateSitePageSeo } from '@/lib/seo/revalidate';
import { createClient } from '@/lib/supabase/server';
import { requireSiteSeoAccess } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSiteSeoAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = (['all', 'service', 'city'].includes(String(body?.scope))
      ? String(body.scope)
      : 'all') as SeoPathSyncScope;

    const result = await syncSitePageSeoPaths(supabaseAdmin, scope);
    revalidateSitePageSeo();
    return NextResponse.json({
      ok: true,
      remapped: result.remapped.length,
      inserted: result.inserted.length,
      removed_duplicates: result.removed_duplicates.length,
      details: result,
      table: SITE_PAGE_SEO_TABLE,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || 'Failed to sync page SEO URLs',
        hint: migrationHintForSitePageSeoError(e?.message || '') || MIGRATION_269_HINT,
      },
      { status: 500 },
    );
  }
}
