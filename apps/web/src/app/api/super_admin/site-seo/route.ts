import {
  buildSitePageSeoInsert,
  mapSitePageSeoRow,
  migrationHintForSitePageSeoError,
  MIGRATION_269_HINT,
  SITE_PAGE_SEO_TABLE,
  sortSitePageSeoRows,
} from '@/lib/site-page-seo';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { revalidateSitePageSeo } from '@/lib/seo/revalidate';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      db: null,
      res: NextResponse.json({ error: 'Database not configured', details: error }, { status: 500 }),
    };
  }
  return { db: supabaseAdmin, res: null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const { data, error } = await db
      .from(SITE_PAGE_SEO_TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('page_path', { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch page SEO',
          details: error.message,
          hint: migrationHintForSitePageSeoError(error.message) || MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: sortSitePageSeoRows((data || []).map(mapSitePageSeoRow)) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json();
    const payload = buildSitePageSeoInsert(body);
    if (!payload.page_path) {
      return NextResponse.json({ error: 'Page path is required' }, { status: 400 });
    }
    if (!payload.title || !payload.description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const { data, error } = await db.from(SITE_PAGE_SEO_TABLE).insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to create page SEO',
          details: error.message,
          hint: migrationHintForSitePageSeoError(error.message) || MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    revalidateSitePageSeo(payload.page_path);
    return NextResponse.json({ data: mapSitePageSeoRow(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
