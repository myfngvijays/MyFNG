import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * GET /api/lead-manager/workshops?verification=all|verified|unverified
 * Workshop list + stats for the lead manager Workshops page. Runs server-side so the
 * page does not depend on browser RLS for workshops / service_leads counts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users_login')
      .select('id, roles!role_id(role_code)')
      .eq('id', user.id)
      .maybeSingle();
    const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
      .trim()
      .toUpperCase();
    if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'AUDITOR'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin: db } = getSupabaseAdmin();
    if (!db) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const verification = String(request.nextUrl.searchParams.get('verification') || 'all').toLowerCase();

    let query = db.from('workshops').select('*').order('created_at', { ascending: false });
    if (verification === 'verified') query = query.eq('is_verified', true);
    else if (verification === 'unverified') query = query.eq('is_verified', false);

    const [listRes, totalRes, verifiedRes, unverifiedRes, jobsRes] = await Promise.all([
      query,
      db.from('workshops').select('id', { count: 'exact', head: true }),
      db.from('workshops').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      db.from('workshops').select('id', { count: 'exact', head: true }).eq('is_verified', false),
      db
        .from('service_leads')
        .select('workshop_id, status')
        .not('workshop_id', 'is', null)
        .is('deleted_at', null)
        .limit(20000),
    ]);

    if (listRes.error) {
      return NextResponse.json({ error: listRes.error.message || 'Failed to load workshops' }, { status: 500 });
    }

    // Per-workshop lead counts by stage. VALIDATED = booking confirmed (active job).
    type Counts = { open: number; booked: number; completed: number; rejected: number; total: number };
    const empty = (): Counts => ({ open: 0, booked: 0, completed: 0, rejected: 0, total: 0 });
    const byWorkshop = new Map<string, Counts>();
    let bookedAll = 0;
    let openAll = 0;
    for (const row of jobsRes.data || []) {
      const id = String((row as { workshop_id?: string }).workshop_id || '');
      if (!id) continue;
      const st = String((row as { status?: string }).status || '').toUpperCase();
      const c = byWorkshop.get(id) || empty();
      c.total += 1;
      if (['VALIDATED', 'ACCEPTED', 'IN_PROGRESS', 'TEAM_ASSIGNED'].includes(st)) {
        c.booked += 1;
        bookedAll += 1;
      } else if (st === 'COMPLETED' || st === 'CLOSED') {
        c.completed += 1;
      } else if (st === 'REJECTED' || st === 'CANCELLED') {
        c.rejected += 1;
      } else {
        c.open += 1;
        openAll += 1;
      }
      byWorkshop.set(id, c);
    }

    const workshops = (listRes.data || []).map((w: any) => {
      const c = byWorkshop.get(String(w.id)) || empty();
      return { ...w, lead_counts: c, active_leads: [{ count: c.booked }] };
    });

    return NextResponse.json({
      success: true,
      workshops,
      stats: {
        total: totalRes.count || 0,
        verified: verifiedRes.count || 0,
        unverified: unverifiedRes.count || 0,
        active_jobs: bookedAll,
        open_leads: openAll,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load workshops' },
      { status: 500 },
    );
  }
}
