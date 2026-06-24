import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { exportCarResaleValuationsCsv, fetchCarResaleValuations } from '@/lib/car-resale-valuations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { db: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  const db = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, error: null };
}

async function requireSuperAdmin(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userRole } = await supabase
    .from('users_login')
    .select('roles(role_code)')
    .eq('id', session.user.id)
    .single();

  // @ts-ignore
  if (userRole?.roles?.role_code !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const, userId: session.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const gate = await requireSuperAdmin(supabase);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { searchParams } = request.nextUrl;
    const preset = searchParams.get('preset') || 'last_30_days';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');
    const q = searchParams.get('q') || '';
    const platform = searchParams.get('platform') || 'all';
    const exportMode = searchParams.get('export') === '1';
    const limit = Number(searchParams.get('limit') || 50);
    const offset = Number(searchParams.get('offset') || 0);

    if (exportMode) {
      const exported = await exportCarResaleValuationsCsv(db, {
        preset,
        customStart,
        customEnd,
        q,
        platform,
      });
      const body = `${exported.summary}\n\n${exported.csv}`;
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
        },
      });
    }

    const report = await fetchCarResaleValuations(db, {
      preset,
      customStart,
      customEnd,
      q,
      platform,
      limit,
      offset,
    });

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[admin/car-resale-valuations][GET]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
