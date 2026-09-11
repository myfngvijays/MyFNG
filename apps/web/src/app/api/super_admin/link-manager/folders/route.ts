import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

    const { data, error } = await supabaseAdmin
      .from('managed_short_links')
      .select('folder, clicks, unique_clicks, qr_scans, is_active, created_at')
      .not('folder', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const map = new Map<
      string,
      { name: string; links: number; clicks: number; unique: number; qr: number; active: number }
    >();

    for (const row of data || []) {
      const name = String(row.folder || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const cur = map.get(key) || { name, links: 0, clicks: 0, unique: 0, qr: 0, active: 0 };
      cur.links += 1;
      cur.clicks += Number(row.clicks) || 0;
      cur.unique += Number(row.unique_clicks) || 0;
      cur.qr += Number(row.qr_scans) || 0;
      if (row.is_active) cur.active += 1;
      map.set(key, cur);
    }

    const folders = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return NextResponse.json({ folders, total: folders.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
