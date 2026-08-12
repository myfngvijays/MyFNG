import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveReportDateRange } from '@/lib/report-date-range';
import { listUniversalLinkEvents } from '@/lib/universal-link/stats';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const params = request.nextUrl.searchParams;
    const preset = params.get('preset') || 'last_7_days';
    const range = resolveReportDateRange(
      preset,
      params.get('from') || params.get('customStart'),
      params.get('to') || params.get('customEnd'),
    );

    const result = await listUniversalLinkEvents(supabaseAdmin, {
      start: range.start,
      end: range.end,
      page: Number(params.get('page') || 1),
      pageSize: Number(params.get('pageSize') || 25),
      platform: params.get('platform') || '',
      utmSource: params.get('utmSource') || '',
      utmMedium: params.get('utmMedium') || '',
      utmCampaign: params.get('utmCampaign') || '',
      q: params.get('q') || '',
    });

    return NextResponse.json({ ...result, range });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load events' }, { status: 500 });
  }
}
