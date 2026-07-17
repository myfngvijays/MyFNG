import {
  buildLiveFileAdminViews,
  LIVE_FILE_KEYS,
  mapLiveFileRow,
  migrationHintForLiveFilesError,
  MIGRATION_274_HINT,
  SITE_SEO_LIVE_FILES_TABLE,
  type LiveFileKey,
} from '@/lib/site-seo-live-files';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { revalidateLiveFiles } from '@/lib/seo/revalidate';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextResponse } from 'next/server';

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

    const data = await buildLiveFileAdminViews();
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json().catch(() => ({}));
    const fileKey = String(body?.file_key || '') as LiveFileKey;
    if (!LIVE_FILE_KEYS.includes(fileKey)) {
      return NextResponse.json({ error: 'Invalid file key' }, { status: 400 });
    }

    const content = String(body?.content ?? '');
    const useCustom = body?.use_custom === true;
    if (useCustom && !content.trim()) {
      return NextResponse.json({ error: 'Custom content cannot be empty when custom mode is enabled' }, { status: 400 });
    }

    const payload = {
      file_key: fileKey,
      content,
      use_custom: useCustom,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from(SITE_SEO_LIVE_FILES_TABLE)
      .upsert(payload, { onConflict: 'file_key' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to save live file',
          details: error.message,
          hint: migrationHintForLiveFilesError(error.message) || MIGRATION_274_HINT,
        },
        { status: 500 },
      );
    }

    revalidateLiveFiles();
    const views = await buildLiveFileAdminViews();
    const saved = mapLiveFileRow(data);
    const view = views.find((item) => item.file_key === fileKey);

    return NextResponse.json({ data: view || saved });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
