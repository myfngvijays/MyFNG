import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { consolidateDuplicateLeadsByPhones } from '@/lib/service-lead-reopen';
import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function friendlyPipelineStatus(status: string | null | undefined): string {
  const s = String(status || '').toUpperCase();
  const map: Record<string, string> = {
    NEW: 'Fresh',
    CONTACTED: 'Contacted',
    ASSIGNED: 'Assigned',
    ACCEPTED: 'Accepted',
    VALIDATED: 'Booking confirmed',
    IN_PROGRESS: 'In Service',
    COMPLETED: 'Service Done',
    REJECTED: 'Lost',
    CANCELLED: 'Cancelled',
    HOLD: 'Hold',
    READY_FOR_DELIVERY: 'Ready for delivery',
  };
  return map[s] || (s ? s.replace(/_/g, ' ') : 'Unknown');
}

async function requireCrmUser(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  // Same robust resolution as /api/telecaller/calls (email → phone → auth id)
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'TELECALLER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true as const,
    userId: String((profile as any)?.id || user.id),
    roleCode,
  };
}

/**
 * GET /api/telecaller/crm/lead-timeline?lead_id=
 * Activity History + Tasks (TeleCRM-style). Also consolidates same-phone duplicate leads.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireCrmUser(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const leadSelectFull =
      'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id, coupon_meta, telecaller_remarks, vehicle_number, vehicle_make, vehicle_model';
    const leadSelectLean =
      'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id';

    let { data: lead, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select(leadSelectFull)
      .eq('id', leadId)
      .maybeSingle();

    if (leadErr && /column|does not exist|Could not find/i.test(String(leadErr.message || ''))) {
      const retry = await supabaseAdmin
        .from('service_leads')
        .select(leadSelectLean)
        .eq('id', leadId)
        .maybeSingle();
      lead = retry.data;
      leadErr = retry.error;
    }

    if (leadErr || !lead) {
      return NextResponse.json({ error: leadErr?.message || 'Lead not found' }, { status: 404 });
    }

    if (gate.roleCode === 'TELECALLER') {
      const assigned = String((lead as any).assigned_telecaller_id || '');
      if (assigned && assigned !== gate.userId) {
        const { count } = await supabaseAdmin
          .from('telecaller_call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', leadId)
          .eq('telecaller_id', gate.userId);
        if (!count) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const phone10 = normalizeCustomerPhone(String((lead as any).customer_phone || ''));
    if (phone10) {
      try {
        await consolidateDuplicateLeadsByPhones(supabaseAdmin, [phone10]);
        const { data: refreshed } = await supabaseAdmin
          .from('service_leads')
          .select(
            'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id, coupon_meta, telecaller_remarks, vehicle_number, vehicle_make, vehicle_model',
          )
          .eq('id', leadId)
          .maybeSingle();
        if (refreshed) lead = refreshed;
      } catch (e) {
        console.warn('[lead-timeline] consolidate skipped', e);
      }
    }

    const phone = normalizePhone(String((lead as any).customer_phone || ''));

    const safeSelect = async (
      run: () => PromiseLike<{ data: any; error: any }>,
      fallback?: () => PromiseLike<{ data: any; error: any }>,
    ) => {
      const first = await run();
      if (!first.error) return first;
      if (fallback) {
        const second = await fallback();
        if (!second.error) return second;
      }
      console.warn('[lead-timeline] query skipped', first.error?.message);
      return { data: [] as any[], error: null };
    };

    const [callsRes, fuRes, waRes, archivedRes] = await Promise.all([
      safeSelect(
        () =>
          supabaseAdmin
            .from('telecaller_call_logs')
            .select(
              'id, call_status, call_duration, outcome, notes, created_at, telecaller_id, call_recording_url, telecaller:telecaller_id(full_name)',
            )
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(50),
        () =>
          supabaseAdmin
            .from('telecaller_call_logs')
            .select('id, call_status, call_duration, outcome, notes, created_at, telecaller_id')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(50),
      ),
      safeSelect(() =>
        supabaseAdmin
          .from('telecaller_follow_ups')
          .select(
            'id, follow_up_type, status, scheduled_time, notes, reason, priority, created_at, completed_at, telecaller_id',
          )
          .eq('lead_id', leadId)
          .order('scheduled_time', { ascending: false })
          .limit(40),
      ),
      phone
        ? safeSelect(
            () =>
              supabaseAdmin
                .from('whatsapp_messages')
                .select(
                  'id, direction, message_type, text_body, media_caption, template_name, status, created_at, sender_phone, recipient_phone',
                )
                .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
                .order('created_at', { ascending: false })
                .limit(40),
            () =>
              supabaseAdmin
                .from('whatsapp_messages')
                .select('id, direction, message_type, status, created_at')
                .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
                .order('created_at', { ascending: false })
                .limit(40),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
      phone10
        ? safeSelect(
            () =>
              supabaseAdmin
                .from('service_leads')
                .select(
                  'id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, created_at, updated_at, deleted_at, coupon_meta',
                )
                .or(
                  `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10},customer_phone.ilike.%${phone10}`,
                )
                .neq('id', leadId)
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false })
                .limit(20),
            () =>
              supabaseAdmin
                .from('service_leads')
                .select('id, lead_number, status, created_at, updated_at')
                .or(
                  `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10}`,
                )
                .neq('id', leadId)
                .order('created_at', { ascending: false })
                .limit(20),
          )
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    type Item = {
      id: string;
      kind: 'call' | 'followup' | 'whatsapp' | 'system' | 'booking';
      at: string;
      title: string;
      body?: string | null;
      meta?: Record<string, unknown>;
    };

    const items: Item[] = [];

    items.push({
      id: `lead-created-${leadId}`,
      kind: 'system',
      at: String((lead as any).created_at),
      title: 'Lead created',
      body: `${String((lead as any).lead_number || '')} · Status: ${friendlyPipelineStatus((lead as any).status)}`,
      meta: { status: (lead as any).status },
    });

    for (const log of callsRes.data || []) {
      const note = String((log as any).notes || '');
      const label = note.match(/^\[([^\]]+)\]/)?.[1] || String((log as any).call_status || 'Call');
      const dur = (log as any).call_duration;
      const durLabel =
        dur != null && Number.isFinite(Number(dur))
          ? Number(dur) >= 60
            ? `${Math.floor(Number(dur) / 60)}m ${Number(dur) % 60}s`
            : `${Number(dur)}s`
          : null;
      const recUrl = String((log as any).call_recording_url || '').trim();
      const hasRec = Boolean(recUrl);
      items.push({
        id: `call-${(log as any).id}`,
        kind: 'call',
        at: String((log as any).created_at),
        title: durLabel ? `Call · ${label} · ${durLabel}` : `Call · ${label}`,
        body: note || null,
        meta: {
          call_log_id: (log as any).id,
          call_status: (log as any).call_status,
          outcome: (log as any).outcome,
          duration: (log as any).call_duration,
          // Telecallers may play via proxy; never expose Smartflo CDN URL for download
          has_call_recording: hasRec,
          call_recording_url: gate.roleCode === 'TELECALLER' ? null : recUrl || null,
          by: (log as any).telecaller?.full_name || null,
        },
      });
    }

    for (const fu of fuRes.data || []) {
      items.push({
        id: `fu-hist-${(fu as any).id}`,
        kind: 'followup',
        at: String((fu as any).completed_at || (fu as any).scheduled_time || (fu as any).created_at),
        title: `Task · ${(fu as any).follow_up_type || 'Follow-up'} · ${(fu as any).status || ''}`,
        body: (fu as any).reason || (fu as any).notes || null,
        meta: { scheduled_time: (fu as any).scheduled_time },
      });
    }

    for (const msg of waRes.data || []) {
      const dir = String((msg as any).direction || '').toUpperCase();
      const text =
        String((msg as any).text_body || '').trim() ||
        String((msg as any).media_caption || '').trim() ||
        ((msg as any).template_name ? `Template: ${(msg as any).template_name}` : null) ||
        String((msg as any).message_type || 'Message');
      items.push({
        id: `wa-${(msg as any).id}`,
        kind: 'whatsapp',
        at: String((msg as any).created_at),
        title: dir === 'INBOUND' ? 'WhatsApp inbound' : 'WhatsApp outbound',
        body: text.slice(0, 280),
        meta: { status: (msg as any).status, message_type: (msg as any).message_type },
      });
    }

    const meta =
      (lead as any).coupon_meta && typeof (lead as any).coupon_meta === 'object'
        ? (lead as any).coupon_meta
        : {};
    if (meta.last_call_label || meta.last_call_result) {
      items.push({
        id: `disp-${leadId}`,
        kind: 'system',
        at: String((lead as any).updated_at || (lead as any).created_at),
        title: `Status · ${meta.last_call_label || meta.last_call_result}`,
        body: (lead as any).telecaller_remarks || null,
      });
    }

    const hist = Array.isArray(meta.profile_history) ? meta.profile_history : [];
    const histMergeIds = new Set<string>();
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i] || {};
      const at = String(h.at || '').trim();
      if (!at) continue;
      const event = String(h.event || '');
      const isMerge = event === 'PHONE_DUPLICATE_MERGED';
      if (isMerge && h.previous_label) histMergeIds.add(String(h.previous_label));
      const statusLabel = friendlyPipelineStatus(h.status || h.previous_status);
      const histBody = isMerge
        ? [
            h.previous_label ? `Lead # ${h.previous_label}` : null,
            `Status: ${statusLabel}`,
            String(h.summary || '').replace(/^Earlier lead[^.]*merged[^·]*·?\s*/i, '').trim() ||
              null,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            h.previous_label || h.previous_status
              ? `Before: ${h.previous_label || friendlyPipelineStatus(h.previous_status)}`
              : null,
            h.workshop_name ? `Workshop: ${h.workshop_name}` : null,
            [h.city, h.pincode].filter(Boolean).join(' · ') || null,
            h.remark ? String(h.remark) : null,
          ]
            .filter(Boolean)
            .join('\n') || null;
      items.push({
        id: `hist-${leadId}-${i}`,
        kind: isMerge ? 'booking' : 'system',
        at,
        title: isMerge
          ? `Earlier booking merged · was ${statusLabel}`
          : String(h.summary || h.event || 'History').slice(0, 160),
        body: histBody,
        meta: {
          event: h.event || null,
          status: h.status || null,
          status_label: statusLabel,
          workshop_name: h.workshop_name || null,
          remark: h.remark || null,
        },
      });
    }

    // Soft-deleted same-phone leads (even if history write missed)
    for (const arch of archivedRes.data || []) {
      const leadNo = String((arch as any).lead_number || (arch as any).id || '');
      if (histMergeIds.has(leadNo)) continue;
      const vehicle = [(arch as any).vehicle_make, (arch as any).vehicle_model, (arch as any).vehicle_number]
        .map((v) => String(v || '').trim())
        .filter((v) => v && v.toUpperCase() !== 'NA')
        .join(' · ');
      const statusLabel = friendlyPipelineStatus((arch as any).status);
      items.push({
        id: `arch-${(arch as any).id}`,
        kind: 'booking',
        at: String((arch as any).deleted_at || (arch as any).updated_at || (arch as any).created_at),
        title: `Earlier booking · was ${statusLabel}`,
        body: [`Lead # ${leadNo}`, `Status: ${statusLabel}`, vehicle || null].filter(Boolean).join('\n'),
        meta: {
          status: (arch as any).status,
          status_label: statusLabel,
          lead_number: leadNo,
          merged: true,
        },
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const now = Date.now();
    const tasks = (fuRes.data || []).map((fu: any) => {
      const status = String(fu.status || 'PENDING').toUpperCase();
      const due = fu.scheduled_time ? new Date(fu.scheduled_time).getTime() : NaN;
      let bucket: 'late' | 'active' | 'closed' = 'active';
      if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'DONE') bucket = 'closed';
      else if (Number.isFinite(due) && due < now && status === 'PENDING') bucket = 'late';
      return {
        id: String(fu.id),
        follow_up_type: fu.follow_up_type || 'CALLBACK',
        status,
        scheduled_time: fu.scheduled_time || null,
        reason: fu.reason || fu.notes || null,
        priority: fu.priority || 'NORMAL',
        bucket,
      };
    });

    return NextResponse.json({
      success: true,
      lead_id: leadId,
      items: items.slice(0, 120),
      tasks,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Timeline failed' }, { status: 500 });
  }
}
