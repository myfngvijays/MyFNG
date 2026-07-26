import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telecaller/crm/leads
 * Advanced filtered queue for Service leads.
 * Query: status, city, source, priority, workshop_id, from, to, q, filter
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const teleCallerId = String(profile?.id || '').trim();
    if (!teleCallerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const city = sp.get('city');
    const source = sp.get('source');
    const priority = sp.get('priority');
    const workshopId = sp.get('workshop_id');
    const from = sp.get('from');
    const to = sp.get('to');
    const q = sp.get('q');
    const filter = sp.get('filter'); // new|callback|incomplete|follow_up|rejected|all
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '80', 10) || 80, 1), 200);

    let query = supabase
      .from('service_leads')
      .select(`
        id, lead_number, customer_name, customer_phone, status, city, created_from, lead_source,
        lead_priority, is_incomplete, follow_up_required, next_follow_up_at, last_call_at,
        total_calls, workshop_id, created_at, coupon_code, payment_mode, vehicle_make, vehicle_model,
        service_type, estimated_amount,
        workshop:workshops(id, name, city)
      `)
      .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status.toUpperCase());
    if (city) query = query.ilike('city', `%${city}%`);
    if (source) query = query.ilike('created_from', `%${source}%`);
    if (priority) query = query.eq('lead_priority', priority.toUpperCase());
    if (workshopId) query = query.eq('workshop_id', workshopId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    if (filter === 'new') {
      query = query.eq('status', 'NEW').is('last_call_at', null);
    } else if (filter === 'callback') {
      query = query.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
    } else if (filter === 'incomplete') {
      query = query.eq('is_incomplete', true);
    } else if (filter === 'follow_up') {
      query = query.eq('follow_up_required', true);
    } else if (filter === 'rejected') {
      query = query.eq('status', 'REJECTED');
    } else if (filter === 'booked') {
      query = query.in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
    }

    if (q) {
      query = query.or(
        `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true, leads: data || [], total: (data || []).length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
