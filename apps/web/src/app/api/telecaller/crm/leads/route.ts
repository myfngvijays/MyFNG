import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { syncRecentWhatsAppInboundLeads } from '@/lib/whatsappAgents/inboundServiceLead';
import { dedupeLeadsByPhone } from '@/lib/service-lead-reopen';
import {
  extractInboundCustomerMessage,
  redactLeadSourceForTelecaller,
} from '@/lib/telecaller/redactLeadSource';
import {
  crmSeesAllLeads,
  isTelecallerCrmRole,
  normalizeRoleCode,
} from '@/lib/telecaller/crmRoles';
import {
  applyCrmLeadDateRange,
  applyCrmNewLeadFilter,
} from '@/lib/telecaller/crmLeadFilters';

export const dynamic = 'force-dynamic';

function leadMessagePreview(lead: Record<string, any>): string | null {
  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  // Do not use meta_referral / ad headlines — telecallers must not see lead source creatives
  const fromMeta = extractInboundCustomerMessage(
    String(meta.last_inbound_message || meta.first_message || '').trim(),
  );
  if (fromMeta) return fromMeta.slice(0, 180);
  const fromProblem = extractInboundCustomerMessage(lead?.problem_description);
  if (fromProblem) return fromProblem.slice(0, 180);
  const fromDesc = extractInboundCustomerMessage(lead?.description);
  if (fromDesc) return fromDesc.slice(0, 180);
  return null;
}

/**
 * GET /api/telecaller/crm/leads
 * Advanced filtered queue for Service leads.
 * Query: status, city, source, priority, workshop_id, from, to, q, filter, telecaller_id
 * Lead Manager / admins see all leads (optional telecaller_id filter).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const teleCallerId = String(profile?.id || '').trim();
    if (!teleCallerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
    if (!isTelecallerCrmRole(roleCode) && roleCode !== 'APP_OPERATIONS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const seesAll = crmSeesAllLeads(roleCode);

    // Never block the leads list on WhatsApp inbound sync (was ~10s+ per request).
    // Opt-in only: ?sync_wa=1
    if (request.nextUrl.searchParams.get('sync_wa') === '1') {
      try {
        await Promise.race([
          syncRecentWhatsAppInboundLeads({ hours: 6, limit: 40 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('wa-sync-timeout')), 2500)),
        ]);
      } catch (syncErr) {
        console.warn('[crm/leads] whatsapp sync skipped', syncErr);
      }
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db = supabaseAdmin || supabase;
    if (!supabaseAdmin && adminError) {
      console.warn('[crm/leads] admin unavailable, using user client:', adminError);
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const city = sp.get('city');
    const priority = sp.get('priority');
    const workshopId = sp.get('workshop_id');
    const from = sp.get('from');
    const to = sp.get('to');
    const q = sp.get('q');
    const filter = sp.get('filter'); // new|interested|will_visit|booking_confirmed|in_service|service_done|lost|callback|incomplete|follow_up|booked|rejected|all
    const lostReason = String(sp.get('lost_reason') || '').trim();
    const telecallerFilter = String(sp.get('telecaller_id') || '').trim();
    const unassignedOnly = sp.get('unassigned') === '1';
    // Chart / export may request larger pages; list UI stays ≤100 for snappy paging
    const requestedLimit = parseInt(sp.get('limit') || '25', 10) || 25;
    const maxLimit = sp.get('for_chart') === '1' ? 1000 : 100;
    const pageSize = Math.min(Math.max(requestedLimit, 1), maxLimit);
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const applyAssigneeScope = (query: any) => {
      if (seesAll) {
        if (unassignedOnly) return query.is('assigned_telecaller_id', null);
        if (telecallerFilter) return query.eq('assigned_telecaller_id', telecallerFilter);
        return query;
      }
      // Same as mobile TelecallerLeadsScreen: assigned to me OR created by me
      return query.or(
        `assigned_telecaller_id.eq.${teleCallerId},created_by_id.eq.${teleCallerId}`,
      );
    };

    const LEAD_LIST_SELECT = `
        id, lead_number, customer_name, customer_phone, status, city,
        lead_priority, is_incomplete, follow_up_required, next_follow_up_at, last_call_at,
        total_calls, workshop_id, created_at, coupon_code, coupon_meta, payment_mode,
        vehicle_make, vehicle_model, vehicle_number, service_type, estimated_amount, problem_description,
        assigned_telecaller_id,
        workshop:workshops(id, name, city),
        assigned_telecaller:users_login!assigned_telecaller_id(id, full_name, phone)
      `;

    let query = db.from('service_leads').select(LEAD_LIST_SELECT, { count: 'exact' });
    query = applyAssigneeScope(query)
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeTo);

    // Soft-deleted hide (ignore if column missing — query will fail and we retry below)
    query = query.is('deleted_at', null);

    if (status) query = query.eq('status', status.toUpperCase());
    if (city) query = query.ilike('city', `%${city}%`);
    // Intentionally ignore `source` filter — telecallers must not segment by lead origin
    if (priority) query = query.eq('lead_priority', priority.toUpperCase());
    if (workshopId) query = query.eq('workshop_id', workshopId);
    query = applyCrmLeadDateRange(query, filter, from, to);

    if (filter === 'new' || filter === 'fresh') {
      query = applyCrmNewLeadFilter(query);
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
    } else if (filter === 'callback' || filter === 'followup' || filter === 'follow_up') {
      // Disposition tile: last call result CALLBACK (not overdue-only follow_up_required)
      query = query.filter('coupon_meta->>last_call_result', 'eq', 'CALLBACK');
    } else if (filter === 'overdue_callback') {
      query = query.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
    } else if (filter === 'incomplete') {
      // Only this telecaller's incomplete booking stubs (matches dashboard KPI).
      query = query.eq('is_incomplete', true);
    } else if (filter && filter !== 'all' && filter !== 'booked' && filter !== 'overdue_callback') {
      // Custom / dynamic CRM statuses → last_call_result code
      query = query.filter('coupon_meta->>last_call_result', 'eq', filter.toUpperCase());
    }

    if (q) {
      query = query.or(
        `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
      );
    }

    let { data, error, count } = await query;

    if (error && /deleted_at/i.test(String(error.message || ''))) {
      // Retry without soft-delete filter for older schemas
      let retry = db.from('service_leads').select(LEAD_LIST_SELECT, { count: 'exact' });
      retry = applyAssigneeScope(retry)
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);

      if (status) retry = retry.eq('status', status.toUpperCase());
      if (city) retry = retry.ilike('city', `%${city}%`);
      if (priority) retry = retry.eq('lead_priority', priority.toUpperCase());
      if (workshopId) retry = retry.eq('workshop_id', workshopId);
      retry = applyCrmLeadDateRange(retry, filter, from, to);
      if (filter === 'new' || filter === 'fresh') retry = applyCrmNewLeadFilter(retry);
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
      } else if (filter === 'callback' || filter === 'followup' || filter === 'follow_up') {
        retry = retry.filter('coupon_meta->>last_call_result', 'eq', 'CALLBACK');
      } else if (filter === 'overdue_callback') {
        retry = retry.eq('follow_up_required', true).lte('next_follow_up_at', new Date().toISOString());
      } else if (filter === 'incomplete') {
        retry = retry.eq('is_incomplete', true);
      } else if (filter && filter !== 'all' && filter !== 'booked' && filter !== 'overdue_callback') {
        retry = retry.filter('coupon_meta->>last_call_result', 'eq', filter.toUpperCase());
      }
      if (q) {
        retry = retry.or(
          `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
        );
      }
      ({ data, error, count } = await retry);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = data || [];
    // Skip healLeadDispositions on list (extra call-log queries + writes). Badges use coupon_meta as-is.

    const deduped = dedupeLeadsByPhone(rows);

    // Attach next pending reminder / follow-up per lead (for list cards)
    const reminderByLead = new Map<
      string,
      { at: string; reason: string | null; type: string | null }
    >();
    try {
      const ids = deduped.map((r: any) => r.id).filter(Boolean);
      if (ids.length) {
        const { data: fus } = await db
          .from('telecaller_follow_ups')
          .select('lead_id, scheduled_time, reason, follow_up_type, status')
          .in('lead_id', ids)
          .eq('status', 'PENDING')
          .order('scheduled_time', { ascending: true })
          .limit(Math.min(ids.length * 3, 400));
        for (const fu of fus || []) {
          const lid = String(fu.lead_id || '');
          if (!lid || reminderByLead.has(lid)) continue;
          reminderByLead.set(lid, {
            at: String(fu.scheduled_time || ''),
            reason: fu.reason ? String(fu.reason) : null,
            type: fu.follow_up_type ? String(fu.follow_up_type) : null,
          });
        }
      }
    } catch (remErr) {
      console.warn('[crm/leads] reminder attach skipped', remErr);
    }

    const leads = deduped.map((row: any) => {
      const hist = Array.isArray(row?.coupon_meta?.profile_history)
        ? row.coupon_meta.profile_history
        : [];
      const preview = leadMessagePreview(row);
      const isWhatsappInbound = Boolean(row?.coupon_meta?.whatsapp_inbound);
      const fromFu = reminderByLead.get(String(row.id));
      const nextAt = fromFu?.at || row.next_follow_up_at || null;
      return seesAll
        ? {
            ...row,
            assigned_telecaller_name:
              row?.assigned_telecaller?.full_name ||
              row?.assigned_telecaller_name ||
              null,
            message_preview: preview,
            history_preview: hist.slice(0, 3),
            is_whatsapp_lead: isWhatsappInbound,
            reminder: nextAt
              ? {
                  at: nextAt,
                  reason: fromFu?.reason || null,
                  type: fromFu?.type || null,
                  overdue: new Date(nextAt).getTime() < Date.now(),
                }
              : null,
          }
        : redactLeadSourceForTelecaller({
            ...row,
            assigned_telecaller_name:
              row?.assigned_telecaller?.full_name ||
              row?.assigned_telecaller_name ||
              null,
            message_preview: preview,
            history_preview: hist.slice(0, 3),
            is_whatsapp_lead: isWhatsappInbound,
            reminder: nextAt
              ? {
                  at: nextAt,
                  reason: fromFu?.reason || null,
                  type: fromFu?.type || null,
                  overdue: new Date(nextAt).getTime() < Date.now(),
                }
              : null,
          });
    });

    return NextResponse.json({
      success: true,
      leads,
      total: typeof count === 'number' ? count : leads.length,
      page,
      page_size: pageSize,
      scope: seesAll ? 'all' : 'mine',
      assigned_telecaller_id: seesAll ? null : teleCallerId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
