import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { syncRecentWhatsAppInboundLeads } from '@/lib/whatsappAgents/inboundServiceLead';
import { dedupeLeadsByPhone } from '@/lib/service-lead-reopen';

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

const DISPOSITION_TO_LEAD_STATUS: Record<string, string> = {
  BOOKING_CONFIRMED: 'VALIDATED',
  IN_SERVICE: 'IN_PROGRESS',
  SERVICE_DONE: 'COMPLETED',
  LOST: 'REJECTED',
};

const DISPOSITION_LABEL: Record<string, string> = {
  INTERESTED: 'Interested',
  WILL_VISIT: 'He will visit',
  BOOKING_CONFIRMED: 'Booking confirmed',
  IN_SERVICE: 'In Service',
  SERVICE_DONE: 'Service Done',
  LOST: 'Lost',
  RINGING: 'Ringing',
};

function latestDisposition(meta: any): string | null {
  const fromResult = String(meta?.last_call_result || '').toUpperCase();
  if (fromResult && fromResult !== 'RINGING') return fromResult;
  const hist = Array.isArray(meta?.profile_history) ? meta.profile_history : [];
  for (const entry of hist) {
    const s = String(entry?.status || '').toUpperCase();
    if (s && s !== 'RINGING') return s;
  }
  return null;
}

/** Fix leads where booking/activity was saved in history but status column stayed NEW. */
async function healLeadStatuses(db: any, rows: any[]) {
  const patches: Promise<any>[] = [];
  for (const row of rows || []) {
    const meta = row?.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
    const disposition = latestDisposition(meta);
    if (!disposition) continue;
    const nextStatus = DISPOSITION_TO_LEAD_STATUS[disposition];
    if (!nextStatus) continue;
    const current = String(row?.status || '').toUpperCase();
    if (current === nextStatus) {
      // Still ensure display label exists for list badge
      if (!meta.last_call_result || !meta.last_call_label) {
        const nextMeta = {
          ...meta,
          last_call_result: meta.last_call_result || disposition,
          last_call_label: meta.last_call_label || DISPOSITION_LABEL[disposition] || disposition,
        };
        row.coupon_meta = nextMeta;
        patches.push(
          db
            .from('service_leads')
            .update({ coupon_meta: nextMeta, updated_at: new Date().toISOString() })
            .eq('id', row.id),
        );
      }
      continue;
    }
    // Only advance from early statuses — don't overwrite ASSIGNED/ACCEPTED etc.
    if (!['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'VALIDATED'].includes(current)) continue;
    if (current === 'VALIDATED' && nextStatus === 'VALIDATED') continue;

    const nextMeta = {
      ...meta,
      last_call_result: meta.last_call_result || disposition,
      last_call_label: meta.last_call_label || DISPOSITION_LABEL[disposition] || disposition,
      last_call_status: meta.last_call_status || 'ANSWERED',
    };
    row.status = nextStatus;
    row.coupon_meta = nextMeta;
    patches.push(
      db
        .from('service_leads')
        .update({
          status: nextStatus,
          coupon_meta: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id),
    );
  }
  if (patches.length) {
    await Promise.allSettled(patches);
  }
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
    const filter = sp.get('filter'); // new|interested|will_visit|booking_confirmed|in_service|service_done|lost|callback|incomplete|follow_up|booked|rejected|all
    const lostReason = String(sp.get('lost_reason') || '').trim();
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '80', 10) || 80, 1), 200);

    let query = db
      .from('service_leads')
      .select(`
        id, lead_number, customer_name, customer_phone, status, city, created_from, lead_source,
        lead_priority, is_incomplete, follow_up_required, next_follow_up_at, last_call_at,
        total_calls, workshop_id, created_at, coupon_code, coupon_meta, payment_mode,
        vehicle_make, vehicle_model, vehicle_number, service_type, estimated_amount, description, problem_description,
        assigned_telecaller_id,
        workshop:workshops(id, name, city)
      `)
      // Unassigned + own + OTP-verified incomplete (website/app abandon) for every telecaller
      .or(
        [
          `assigned_telecaller_id.is.null`,
          `assigned_telecaller_id.eq.${teleCallerId}`,
          `coupon_meta->>last_call_result.eq.OTP_VERIFIED`,
          `coupon_meta->>website_otp_verified.eq.true`,
        ].join(','),
      )
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
      query = query.eq('status', 'NEW');
    } else if (filter === 'interested') {
      query = query.filter('coupon_meta->>last_call_result', 'eq', 'INTERESTED');
    } else if (filter === 'will_visit') {
      query = query.filter('coupon_meta->>last_call_result', 'eq', 'WILL_VISIT');
    } else if (filter === 'booking_confirmed') {
      query = query.eq('status', 'VALIDATED');
    } else if (filter === 'booked') {
      query = query.in('status', [
        'VALIDATED',
        'ASSIGNED',
        'ACCEPTED',
        'IN_PROGRESS',
        'COMPLETED',
      ]);
    } else if (filter === 'in_service') {
      query = query.eq('status', 'IN_PROGRESS');
    } else if (filter === 'service_done') {
      query = query.eq('status', 'COMPLETED');
    } else if (filter === 'lost' || filter === 'rejected') {
      query = query.eq('status', 'REJECTED');
      if (lostReason) {
        query = query.filter('coupon_meta->>last_lost_reason', 'eq', lostReason);
      }
    } else if (filter === 'callback') {
      query = query.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
    } else if (filter === 'incomplete') {
      // Incomplete booking stubs + website/app OTP-verified (not yet booked)
      query = query.or(
        'is_incomplete.eq.true,coupon_meta->>last_call_result.eq.OTP_VERIFIED,coupon_meta->>website_otp_verified.eq.true',
      );
    } else if (filter === 'follow_up') {
      query = query.eq('follow_up_required', true);
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
          vehicle_make, vehicle_model, vehicle_number, service_type, estimated_amount, description, problem_description,
          assigned_telecaller_id,
          workshop:workshops(id, name, city)
        `)
        .or(
          [
            `assigned_telecaller_id.is.null`,
            `assigned_telecaller_id.eq.${teleCallerId}`,
            `coupon_meta->>last_call_result.eq.OTP_VERIFIED`,
            `coupon_meta->>website_otp_verified.eq.true`,
          ].join(','),
        )
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
      if (filter === 'new') retry = retry.eq('status', 'NEW');
      else if (filter === 'interested') {
        retry = retry.filter('coupon_meta->>last_call_result', 'eq', 'INTERESTED');
      } else if (filter === 'will_visit') {
        retry = retry.filter('coupon_meta->>last_call_result', 'eq', 'WILL_VISIT');
      } else if (filter === 'booking_confirmed') {
        retry = retry.eq('status', 'VALIDATED');
      } else if (filter === 'booked') {
        retry = retry.in('status', [
          'VALIDATED',
          'ASSIGNED',
          'ACCEPTED',
          'IN_PROGRESS',
          'COMPLETED',
        ]);
      } else if (filter === 'in_service') retry = retry.eq('status', 'IN_PROGRESS');
      else if (filter === 'service_done') retry = retry.eq('status', 'COMPLETED');
      else if (filter === 'lost' || filter === 'rejected') {
        retry = retry.eq('status', 'REJECTED');
        if (lostReason) {
          retry = retry.filter('coupon_meta->>last_lost_reason', 'eq', lostReason);
        }
      } else if (filter === 'callback') {
        retry = retry.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
      } else if (filter === 'incomplete') {
        retry = retry.or(
          'is_incomplete.eq.true,coupon_meta->>last_call_result.eq.OTP_VERIFIED,coupon_meta->>website_otp_verified.eq.true',
        );
      } else if (filter === 'follow_up') retry = retry.eq('follow_up_required', true);
      if (q) {
        retry = retry.or(
          `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
        );
      }
      ({ data, error } = await retry);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = data || [];
    try {
      await healLeadStatuses(db, rows);
    } catch (healErr) {
      console.warn('[crm/leads] status heal skipped', healErr);
    }

    const deduped = dedupeLeadsByPhone(rows);

    const leads = deduped.map((row: any) => {
      const hist = Array.isArray(row?.coupon_meta?.profile_history)
        ? row.coupon_meta.profile_history
        : [];
      return {
        ...row,
        message_preview: leadMessagePreview(row),
        history_preview: hist.slice(0, 3),
        is_whatsapp_lead:
          /whatsapp|meta|instagram|facebook/i.test(
            `${row?.created_from || ''} ${row?.lead_source || ''}`,
          ) || Boolean(row?.coupon_meta?.whatsapp_inbound),
      };
    });

    return NextResponse.json({ success: true, leads, total: leads.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
