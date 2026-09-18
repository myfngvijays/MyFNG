import { migrationHintForSitePageSeoError, MIGRATION_269_HINT } from '@/lib/site-page-seo';
import { syncSitePageSeoPaths } from '@/lib/site-page-seo-sync';
import { revalidateSitePageSeo } from '@/lib/seo/revalidate';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSiteSeoAccess } from '@/lib/super-admin-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const auth = await requireSiteSeoAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const result = await syncSitePageSeoPaths(supabaseAdmin, 'city');
    revalidateSitePageSeo();
    return NextResponse.json({
      inserted: result.inserted.length,
      remapped: result.remapped.length,
      details: result,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || 'Failed to seed city page SEO',
        hint: migrationHintForSitePageSeoError(e?.message || '') || MIGRATION_269_HINT,
      },
      { status: 500 },
    );
  }
}
