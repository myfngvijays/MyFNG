import {
  buildSitePageSeoUpdate,
  mapSitePageSeoRow,
  migrationHintForSitePageSeoError,
  MIGRATION_269_HINT,
  normalizePagePath,
  SITE_PAGE_SEO_TABLE,
} from '@/lib/site-page-seo';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { revalidateSitePageSeo } from '@/lib/seo/revalidate';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function revalidatePageSeo(path?: string) {
  revalidateSitePageSeo(path);
}

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
    const updates = buildSitePageSeoUpdate(body);
    if (body.title !== undefined && !String(body.title || '').trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (body.description !== undefined && !String(body.description || '').trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from(SITE_PAGE_SEO_TABLE)
      .select('page_path')
      .eq('id', id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Page SEO entry not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from(SITE_PAGE_SEO_TABLE)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to update page SEO',
          details: error.message,
          hint: migrationHintForSitePageSeoError(error.message) || MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    const row = mapSitePageSeoRow(data);
    revalidatePageSeo(String(existing.page_path));
    revalidatePageSeo(row.page_path);
    return NextResponse.json({ data: row });
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

    const { data: existing } = await supabaseAdmin
      .from(SITE_PAGE_SEO_TABLE)
      .select('page_path')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from(SITE_PAGE_SEO_TABLE).delete().eq('id', id);
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to delete page SEO',
          details: error.message,
          hint: MIGRATION_269_HINT,
        },
        { status: 500 },
      );
    }

    if (existing?.page_path) revalidatePageSeo(String(existing.page_path));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
