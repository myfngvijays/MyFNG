import {
  buildSiteTechnicalSeoUpdate,
  buildTechnicalSeoOverview,
  mapSiteTechnicalSeoRow,
  migrationHintForSiteTechnicalSeoError,
  MIGRATION_273_HINT,
  SITE_TECHNICAL_SEO_KEY,
  SITE_TECHNICAL_SEO_TABLE,
} from '@/lib/site-technical-seo';
import { listSitePageSitemapEntries } from '@/lib/site-page-seo';
import { listBlogSitemapEntries, listWorkshopSitemapEntries } from '@/lib/workshop-page-seo';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { revalidateLiveFiles, revalidateTechnicalSeo } from '@/lib/seo/revalidate';
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

async function buildOverview() {
  const [sitePages, workshops, blogs] = await Promise.all([
    listSitePageSitemapEntries(),
    listWorkshopSitemapEntries(),
    listBlogSitemapEntries(),
  ]);

  return buildTechnicalSeoOverview({
    site_pages: sitePages.length,
    workshops: workshops.length,
    blogs: blogs.length,
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const { data, error } = await db
      .from(SITE_TECHNICAL_SEO_TABLE)
      .select('*')
      .eq('config_key', SITE_TECHNICAL_SEO_KEY)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch technical SEO',
          details: error.message,
          hint: migrationHintForSiteTechnicalSeoError(error.message) || MIGRATION_273_HINT,
        },
        { status: 500 },
      );
    }

    const overview = await buildOverview();
    return NextResponse.json({ data: mapSiteTechnicalSeoRow(data), overview });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json();
    const updates = buildSiteTechnicalSeoUpdate(body);

    if (body.default_title !== undefined && !String(body.default_title || '').trim()) {
      return NextResponse.json({ error: 'Default title is required' }, { status: 400 });
    }
    if (body.default_description !== undefined && !String(body.default_description || '').trim()) {
      return NextResponse.json({ error: 'Default description is required' }, { status: 400 });
    }

    const { data: existing } = await db
      .from(SITE_TECHNICAL_SEO_TABLE)
      .select('config_key')
      .eq('config_key', SITE_TECHNICAL_SEO_KEY)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      ({ data, error } = await db
        .from(SITE_TECHNICAL_SEO_TABLE)
        .update(updates)
        .eq('config_key', SITE_TECHNICAL_SEO_KEY)
        .select('*')
        .single());
    } else {
      ({ data, error } = await db
        .from(SITE_TECHNICAL_SEO_TABLE)
        .insert({ config_key: SITE_TECHNICAL_SEO_KEY, ...updates })
        .select('*')
        .single());
    }

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to save technical SEO',
          details: error.message,
          hint: migrationHintForSiteTechnicalSeoError(error.message) || MIGRATION_273_HINT,
        },
        { status: 500 },
      );
    }

    revalidateTechnicalSeo();
    revalidateLiveFiles();
    const overview = await buildOverview();
    return NextResponse.json({ data: mapSiteTechnicalSeoRow(data), overview });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
