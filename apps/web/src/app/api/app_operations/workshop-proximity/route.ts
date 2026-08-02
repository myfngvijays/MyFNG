import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWorkshopGeofenceRadiusM } from '@/lib/workshop-proximity';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'APP_OPERATIONS', 'SUB_ADMIN']);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles(role_code)')
    .eq('id', auth.user.id)
    .maybeSingle();

  const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
  if (!ALLOWED_ROLES.has(roleCode)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server config error' }, { status: 500 });

  const url = new URL(request.url);
  const onlyWalkIns = url.searchParams.get('walk_ins') === '1';
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));

  let query = supabaseAdmin
    .from('workshop_proximity_events')
    .select(
      'id, event_type, source, distance_m, had_active_booking, ops_alert_sent, customer_nudge_sent, created_at, metadata, customer:customer_id(id, full_name, phone), workshop:workshop_id(id, name, workshop_name, city)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (onlyWalkIns) {
    query = query.eq('had_active_booking', false).eq('ops_alert_sent', true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: walkInAlerts24h } = await supabaseAdmin
    .from('workshop_proximity_events')
    .select('id', { count: 'exact', head: true })
    .eq('had_active_booking', false)
    .eq('ops_alert_sent', true)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const geofenceRadiusM = await getWorkshopGeofenceRadiusM(supabaseAdmin);

  return NextResponse.json({
    success: true,
    events: data || [],
    stats: {
      walk_in_alerts_24h: walkInAlerts24h || 0,
      geofence_radius_m: geofenceRadiusM,
    },
  });
}
