import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { syncRecentWhatsAppInboundLeads } from '@/lib/whatsappAgents/inboundServiceLead';

export const dynamic = 'force-dynamic';

function leadMessagePreview(lead: Record<string, any>): string | null {
  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const fromMeta =
    String(meta.last_inbound_message || meta.first_message || '').trim() ||
    String(meta.meta_referral?.headline || '').trim();
  if (fromMeta) return fromMeta.slice(0, 180);
  const fromProblem = String(lead?.problem_description || '').trim();
  if (fromProblem) return fromProblem.slice(0, 180);
  const fromDesc = String(lead?.description || '').trim();
  if (fromDesc) return fromDesc.slice(0, 180);
  return null;
}

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

    // Pull latest WhatsApp chats into leads (covers production webhook lag / local API).
    try {
      await syncRecentWhatsAppInboundLeads({ hours: 24, limit: 80 });
    } catch (syncErr) {
      console.warn('[crm/leads] whatsapp sync skipped', syncErr);
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db = supabaseAdmin || supabase;
    if (!supabaseAdmin && adminError) {
      console.warn('[crm/leads] admin unavailable, using user client:', adminError);
    }

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

    let query = db
      .from('service_leads')
      .select(`
        id, lead_number, customer_name, customer_phone, status, city, created_from, lead_source,
        lead_priority, is_incomplete, follow_up_required, next_follow_up_at, last_call_at,
        total_calls, workshop_id, created_at, coupon_code, coupon_meta, payment_mode,
        vehicle_make, vehicle_model, service_type, estimated_amount, description, problem_description,
        assigned_telecaller_id,
        workshop:workshops(id, name, city)
      `)
      .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Soft-deleted hide (ignore if column missing — query will fail and we retry below)
    query = query.is('deleted_at', null);

    if (status) query = query.eq('status', status.toUpperCase());
    if (city) query = query.ilike('city', `%${city}%`);
    if (source) {
      // Match either created_from channel or human lead_source label
      query = query.or(
        `created_from.ilike.%${source}%,lead_source.ilike.%${source}%`,
      );
    }
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
        `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
      );
    }

    let { data, error } = await query;

    if (error && /deleted_at/i.test(String(error.message || ''))) {
      // Retry without soft-delete filter for older schemas
      let retry = db
        .from('service_leads')
        .select(`
          id, lead_number, customer_name, customer_phone, status, city, created_from, lead_source,
          lead_priority, is_incomplete, follow_up_required, next_follow_up_at, last_call_at,
          total_calls, workshop_id, created_at, coupon_code, coupon_meta, payment_mode,
          vehicle_make, vehicle_model, service_type, estimated_amount, description, problem_description,
          assigned_telecaller_id,
          workshop:workshops(id, name, city)
        `)
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) retry = retry.eq('status', status.toUpperCase());
      if (city) retry = retry.ilike('city', `%${city}%`);
      if (source) {
        retry = retry.or(`created_from.ilike.%${source}%,lead_source.ilike.%${source}%`);
      }
      if (priority) retry = retry.eq('lead_priority', priority.toUpperCase());
      if (workshopId) retry = retry.eq('workshop_id', workshopId);
      if (from) retry = retry.gte('created_at', from);
      if (to) retry = retry.lte('created_at', to);
      if (filter === 'new') retry = retry.eq('status', 'NEW').is('last_call_at', null);
      else if (filter === 'callback') {
        retry = retry.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
      } else if (filter === 'incomplete') retry = retry.eq('is_incomplete', true);
      else if (filter === 'follow_up') retry = retry.eq('follow_up_required', true);
      else if (filter === 'rejected') retry = retry.eq('status', 'REJECTED');
      else if (filter === 'booked') {
        retry = retry.in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
      }
      if (q) {
        retry = retry.or(
          `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
        );
      }
      ({ data, error } = await retry);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const leads = (data || []).map((row: any) => ({
      ...row,
      message_preview: leadMessagePreview(row),
      is_whatsapp_lead:
        /whatsapp|meta|instagram|facebook/i.test(
          `${row?.created_from || ''} ${row?.lead_source || ''}`,
        ) || Boolean(row?.coupon_meta?.whatsapp_inbound),
    }));

    return NextResponse.json({ success: true, leads, total: leads.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
