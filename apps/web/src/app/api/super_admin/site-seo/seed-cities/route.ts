import { buildCityPageSeoDefaults } from '@/lib/city-pages';
import {
  buildSitePageSeoInsert,
  mapSitePageSeoRow,
  migrationHintForSitePageSeoError,
  MIGRATION_269_HINT,
  SITE_PAGE_SEO_TABLE,
} from '@/lib/site-page-seo';
import { revalidateSitePageSeo } from '@/lib/seo/revalidate';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const defaults = buildCityPageSeoDefaults();
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from(SITE_PAGE_SEO_TABLE)
      .select('page_path');

    if (existingError) {
      return NextResponse.json(
        {
          error: 'Failed to read existing page SEO',
          details: existingError.message,
          hint: migrationHintForSitePageSeoError(existingError.message) || MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    const existingPaths = new Set((existingRows || []).map((row: any) => String(row.page_path)));
    const missing = defaults.filter((row) => !existingPaths.has(row.page_path));
    if (missing.length === 0) {
      return NextResponse.json({ inserted: 0, data: [] });
    }

    const payload = missing.map((row) => buildSitePageSeoInsert(row));
    const { data, error } = await supabaseAdmin.from(SITE_PAGE_SEO_TABLE).insert(payload).select('*');
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to seed city page SEO',
          details: error.message,
          hint: migrationHintForSitePageSeoError(error.message) || MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    revalidateSitePageSeo();
    return NextResponse.json({ inserted: (data || []).length, data: (data || []).map(mapSitePageSeoRow) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
