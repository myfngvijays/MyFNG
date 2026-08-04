import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveReportDateRange } from '@/lib/report-date-range';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
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
    const customStart = params.get('from') || params.get('customStart');
    const customEnd = params.get('to') || params.get('customEnd');
    const range = resolveReportDateRange(preset, customStart, customEnd);

    const [links, clicksInRange, topLinks, recentClicks, qrInRange] = await Promise.all([
      supabaseAdmin.from('managed_short_links').select('id,clicks,unique_clicks,qr_scans,is_active', { count: 'exact' }),
      supabaseAdmin
        .from('managed_short_link_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'click')
        .gte('created_at', range.start)
        .lte('created_at', range.end),
      supabaseAdmin
        .from('managed_short_links')
        .select('id,short_code,title,clicks,unique_clicks,qr_scans,long_url')
        .order('clicks', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('managed_short_link_clicks')
        .select('id,event_type,created_at,referrer,link:managed_short_links(short_code,title)')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('managed_short_link_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'qr_scan')
        .gte('created_at', range.start)
        .lte('created_at', range.end),
    ]);

    const rows = links.data || [];
    const totalClicks = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
    const totalUnique = rows.reduce((sum, r) => sum + Number(r.unique_clicks || 0), 0);
    const totalQr = rows.reduce((sum, r) => sum + Number(r.qr_scans || 0), 0);
    const activeLinks = rows.filter((r) => r.is_active).length;

    return NextResponse.json({
      range: {
        preset: range.preset,
        label: range.label,
        start: range.start,
        end: range.end,
      },
      kpis: {
        total_links: links.count || 0,
        active_links: activeLinks,
        total_clicks: totalClicks,
        unique_clicks: totalUnique,
        qr_scans: totalQr,
        clicks_in_range: clicksInRange.count || 0,
        qr_scans_in_range: qrInRange.count || 0,
      },
      top_links: topLinks.data || [],
      recent_clicks: recentClicks.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
