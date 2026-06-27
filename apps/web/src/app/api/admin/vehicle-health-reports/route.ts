import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { exportVehicleHealthReportsCsv, fetchVehicleHealthReports } from '@/lib/vehicle-health-reports';
import { requireSuperAdmin } from '@/lib/super-admin-auth';

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

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
      const exported = await exportVehicleHealthReportsCsv(db, {
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

    const report = await fetchVehicleHealthReports(db, {
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
    console.error('[admin/vehicle-health-reports][GET]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
