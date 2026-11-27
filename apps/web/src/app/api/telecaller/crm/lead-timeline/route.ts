import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { consolidateDuplicateLeadsByPhones } from '@/lib/service-lead-reopen';
import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  ADMIN_CRM_STATUS_OPTIONS,
  resolveAdminCrmStatusId,
} from '@/lib/telecaller/leadDisplayStatus';
import { detachForeignDidRecordingsForLead, detachForeignDidRecordingsThrottled, healSmartfloRecordingForLead } from '@/lib/telecaller/smartfloCdr';
import { crmLeadIsLost, followUpAutoClosed } from '@/lib/telecaller/crmFollowUpClose';
import {
  buildCheckoutLeadIndex,
  checkoutServiceName,
  isAdminCustomRepairLead,
} from '@/lib/admin-checkout-lead-group';
import { buildLeadOwnerSegments, leadOwnerAt } from '@/lib/telecaller/activityOwnerAtTime';
import {
  buildPricingShareTimelineActivity,
  normalizePricingShareUrl,
  pricingSharePublicUrl,
  resolvePricingShareUrlFromMessage,
} from '@/lib/telecaller/pricingShareLinks';
import {
  formatPricingShareBubbleBody,
  isPricingShareButtonMessage,
} from '@/lib/telecaller/pricingShareWhatsAppPreview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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

function crmStatusLabel(lead: any): string {
  const id = resolveAdminCrmStatusId(lead);
  return ADMIN_CRM_STATUS_OPTIONS.find((opt) => opt.id === id)?.label || friendlyPipelineStatus(lead?.status);
}

function pushPricingShareActivity(
  items: Array<{ id: string; kind: string; at: string; title: string; body?: string | null; meta?: Record<string, unknown> }>,
  seen: Set<string>,
  input: { id: string; at: string; url: string; expiresAt?: string | null; by?: string | null },
) {
  const url = normalizePricingShareUrl(input.url);
  if (!url || !input.at || seen.has(url)) return;
  seen.add(url);
  items.push(buildPricingShareTimelineActivity({ ...input, url }));
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

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'TELECALLER', 'APP_OPERATIONS'].includes(roleCode)) {
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

    void detachForeignDidRecordingsForLead(leadId);
    void healSmartfloRecordingForLead(leadId);
    void detachForeignDidRecordingsThrottled();

    const leadSelectFull =
      'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id, coupon_meta, vehicle_number, vehicle_make, vehicle_model, service_type, meta';
    const leadSelectLean =
      'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id, coupon_meta';

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
      void consolidateDuplicateLeadsByPhones(supabaseAdmin, [phone10]).catch((e) =>
        console.warn('[lead-timeline] consolidate skipped', e),
      );
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

    let relatedLeadIds = [leadId];
    let siblingLeads: any[] = [];
    if (phone10) {
      const sib = await safeSelect(() =>
        supabaseAdmin
          .from('service_leads')
          .select(
            'id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, created_at, updated_at, deleted_at, service_type, meta, coupon_meta, customer_phone',
          )
          .or(
            `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10},customer_phone.ilike.%${phone10}`,
          )
          .neq('id', leadId)
          .order('created_at', { ascending: false })
          .limit(30),
      );
      siblingLeads = sib.data || [];
      relatedLeadIds = [
        leadId,
        ...Array.from(new Set(siblingLeads.map((r) => String(r.id || '')).filter(Boolean))),
      ];
    }

    const leadNumberById = new Map<string, string>([
      [leadId, String((lead as any).lead_number || '')],
      ...siblingLeads.map((r) => [String(r.id), String(r.lead_number || '')] as [string, string]),
    ]);

    const [callsRes, fuRes, waRes, shareLinksRes, archivedRes, eventsRes] = await Promise.all([
      safeSelect(
        () =>
          supabaseAdmin
            .from('telecaller_call_logs')
            .select(
              'id, lead_id, call_status, call_duration, outcome, notes, created_at, telecaller_id, call_recording_url, telecaller:telecaller_id(full_name)',
            )
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(80),
        () =>
          supabaseAdmin
            .from('telecaller_call_logs')
            .select('id, lead_id, call_status, call_duration, outcome, notes, created_at, telecaller_id')
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(80),
      ),
      safeSelect(
        () =>
          supabaseAdmin
            .from('telecaller_follow_ups')
            .select(
              'id, lead_id, follow_up_type, status, scheduled_time, notes, reason, priority, created_at, updated_at, completed_at, completed_by, completion_notes, telecaller_id',
            )
            .in('lead_id', relatedLeadIds)
            .order('scheduled_time', { ascending: false })
            .limit(60),
        () =>
          supabaseAdmin
            .from('telecaller_follow_ups')
            .select('id, lead_id, follow_up_type, status, scheduled_time, reason, priority, created_at, telecaller_id')
            .in('lead_id', relatedLeadIds)
            .order('scheduled_time', { ascending: false })
            .limit(60),
      ),
      phone
        ? safeSelect(
            () =>
              supabaseAdmin
                .from('whatsapp_messages')
                .select(
                  'id, direction, message_type, text_body, media_caption, template_name, status, created_at, sender_phone, recipient_phone, created_by, meta, actor:created_by(full_name)',
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
      safeSelect(
        () =>
          supabaseAdmin
            .from('pricing_share_links')
            .select('id, slug, expires_at, created_at, lead_id')
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(30),
        () =>
          supabaseAdmin
            .from('pricing_share_links')
            .select('slug, expires_at, created_at, lead_id')
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(30),
      ),
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
      safeSelect(
        () =>
          supabaseAdmin
            .from('lead_events')
            .select('id, event_type, event_description, actor_name, metadata, created_at')
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(40),
        () =>
          supabaseAdmin
            .from('lead_events')
            .select('id, event_type, created_at')
            .in('lead_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(40),
      ),
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
    const pricingShareExpiresBySlug = new Map<string, string>();
    for (const row of shareLinksRes.data || []) {
      const slug = String((row as any).slug || '')
        .trim()
        .toLowerCase();
      const exp = String((row as any).expires_at || '').trim();
      if (slug && exp && !pricingShareExpiresBySlug.has(slug)) {
        pricingShareExpiresBySlug.set(slug, exp);
      }
    }
    const pricingShareSeen = new Set<string>();

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
      const callLeadId = String((log as any).lead_id || leadId);
      const otherLeadNo = callLeadId !== leadId ? leadNumberById.get(callLeadId) : '';
      items.push({
        id: `call-${(log as any).id}`,
        kind: 'call',
        at: String((log as any).created_at),
        title: [
          durLabel ? `Call · ${label} · ${durLabel}` : `Call · ${label}`,
          otherLeadNo ? `#${otherLeadNo}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        body: note || null,
        meta: {
          call_log_id: (log as any).id,
          lead_id: callLeadId,
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

    const reminderNameIds = new Set<string>();
    for (const fu of fuRes.data || []) {
      if ((fu as any).telecaller_id) reminderNameIds.add(String((fu as any).telecaller_id));
      if ((fu as any).completed_by) reminderNameIds.add(String((fu as any).completed_by));
    }
    const reminderNames = new Map<string, string>();
    if (reminderNameIds.size) {
      const { data: people } = await supabaseAdmin
        .from('users_login')
        .select('id, full_name')
        .in('id', Array.from(reminderNameIds));
      for (const person of people || []) {
        reminderNames.set(String(person.id), String(person.full_name || '').trim());
      }
    }
    const reminderStamp = (iso: string) => {
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      }).formatToParts(date);
      const day = Number(parts.find((part) => part.type === 'day')?.value || '0');
      const month = parts.find((part) => part.type === 'month')?.value || '';
      const year = parts.find((part) => part.type === 'year')?.value || '';
      const teen = day % 100;
      const suffix =
        teen >= 11 && teen <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
      return `${day}${suffix} ${month} ${year}`;
    };
    for (const fu of fuRes.data || []) {
      const row = fu as any;
      const assignee = reminderNames.get(String(row.telecaller_id || '')) || 'telecaller';
      const when = reminderStamp(String(row.scheduled_time || row.created_at || ''));
      const reason = String(row.reason || row.notes || '').trim();
      if (row.created_at || row.scheduled_time) {
        items.push({
          id: `fu-created-${row.id}`,
          kind: 'followup',
          at: String(row.created_at || row.scheduled_time),
          title: `Call Reminder of ${when} is created for ${assignee}`,
          body: reason || null,
          meta: { scheduled_time: row.scheduled_time, status: row.status },
        });
      }
      const rowStatus = String(row.status || '').toUpperCase();
      const rowLead = String(row.lead_id || '') === leadId
        ? lead
        : siblingLeads.find((s) => String(s.id) === String(row.lead_id || ''));
      // Older Lost leads: reminder was auto-closed as COMPLETED before Lost started cancelling them.
      const cancelledForLost =
        (rowStatus === 'CANCELLED' && /lost/i.test(String(row.completion_notes || ''))) ||
        (rowStatus === 'COMPLETED' && followUpAutoClosed(row) && crmLeadIsLost(rowLead as any));
      const cancelAt = String(row.completed_at || '') || (rowStatus === 'CANCELLED' ? String(row.updated_at || '') : '');
      if (rowStatus === 'CANCELLED' || cancelledForLost) {
        const cancelledBy = reminderNames.get(String(row.completed_by || ''));
        if (cancelAt) {
          items.push({
            id: `fu-cancel-${row.id}`,
            kind: 'followup',
            at: cancelAt,
            title: cancelledForLost
              ? `Call Reminder of ${when} cancelled — lead marked Lost`
              : `Call Reminder of ${when} cancelled${cancelledBy ? ` by ${cancelledBy}` : ''}`,
            body: reason || null,
            meta: { scheduled_time: row.scheduled_time, status: 'CANCELLED' },
          });
        }
        // Show the "created" row with a Cancelled badge, not Completed.
        const created = items.find((it) => it.id === `fu-created-${row.id}`);
        if (created) created.meta = { ...(created.meta || {}), status: 'CANCELLED' };
      } else if (rowStatus === 'COMPLETED' && row.completed_at) {
        const doneBy = reminderNames.get(String(row.completed_by || '')) || assignee;
        items.push({
          id: `fu-done-${row.id}`,
          kind: 'followup',
          at: String(row.completed_at),
          title: `Call Reminder Done by ${doneBy} at ${reminderStamp(String(row.completed_at))}`,
          body: reason || null,
          meta: { scheduled_time: row.scheduled_time, status: 'COMPLETED' },
        });
      }
    }

    for (const msg of waRes.data || []) {
      const dir = String((msg as any).direction || '').toUpperCase();
      const rawText = String(
        (msg as any).text_body || (msg as any).media_caption || (msg as any).template_name || '',
      ).trim();
      const msgLike = {
        template_name: (msg as any).template_name,
        text_body: (msg as any).text_body,
        meta: (msg as any).meta,
      };
      const waText = formatPricingShareBubbleBody(msgLike) || rawText;
      const waActor = String((msg as any).actor?.full_name || '').trim();
      items.push({
        id: `wa-${(msg as any).id}`,
        kind: 'whatsapp',
        at: String((msg as any).created_at),
        title: dir === 'INBOUND' ? 'WhatsApp received' : 'WhatsApp sent',
        body: waText || null,
        meta: {
          status: (msg as any).status,
          message_type: (msg as any).message_type,
          direction: dir === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
          by: waActor || null,
        },
      });
      if (dir === 'OUTBOUND' && isPricingShareButtonMessage(msgLike)) {
        const { url, slug } = resolvePricingShareUrlFromMessage(msgLike);
        if (url) {
          pushPricingShareActivity(items, pricingShareSeen, {
            id: `pricing-wa-${(msg as any).id}`,
            at: String((msg as any).created_at),
            url,
            expiresAt: pricingShareExpiresBySlug.get(slug) || null,
            by: waActor || null,
          });
        }
      }
    }

    const transferRes = await safeSelect(() =>
      supabaseAdmin
        .from('telecaller_lead_transfers')
        .select(
          'id, created_at, transfer_type, reason, from_telecaller_id, to_telecaller_id, from:from_telecaller_id(full_name), to:to_telecaller_id(full_name)',
        )
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(40),
    );

    const transferRows = (transferRes.data || []).map((t: any) => ({
      created_at: String(t.created_at || ''),
      from_telecaller_id: String(t.from_telecaller_id || ''),
      to_telecaller_id: String(t.to_telecaller_id || ''),
      from_name: String(t.from?.full_name || '').trim(),
      to_name: String(t.to?.full_name || '').trim(),
    }));

    for (const t of transferRes.data || []) {
      const fromName = String((t as any).from?.full_name || 'Telecaller').trim();
      const toName = String((t as any).to?.full_name || 'Telecaller').trim();
      const type = String((t as any).transfer_type || 'TRANSFER').toUpperCase();
      const title =
        type === 'ESCALATE'
          ? `Lead escalated · ${fromName} → ${toName}`
          : `Lead transferred · ${fromName} → ${toName}`;
      items.push({
        id: `xfer-${(t as any).id}`,
        kind: 'system',
        at: String((t as any).created_at),
        title,
        body: String((t as any).reason || '').trim() || null,
        meta: {
          event: 'LEAD_TRANSFER',
          transfer: true,
          from_name: fromName,
          to_name: toName,
          by: fromName,
        },
      });
    }

    let currentAssigneeName = '';
    const assignedId = String((lead as any).assigned_telecaller_id || '');
    if (assignedId) {
      const who = await safeSelect(() =>
        supabaseAdmin.from('users_login').select('full_name').eq('id', assignedId).maybeSingle(),
      );
      currentAssigneeName = String((who.data as any)?.full_name || '').trim();
    }

    const ownerSegments = buildLeadOwnerSegments(
      transferRows,
      String((lead as any).created_at || ''),
      assignedId,
      currentAssigneeName,
    );

    const meta =
      (lead as any).coupon_meta && typeof (lead as any).coupon_meta === 'object'
        ? (lead as any).coupon_meta
        : {};

    const hist = Array.isArray(meta.profile_history) ? meta.profile_history : [];
    const histMergeIds = new Set<string>();
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i] || {};
      const at = String(h.at || '').trim();
      if (!at) continue;
      const event = String(h.event || '');
      if (event === 'PRICING_SHARE') {
        const shareUrl = String(h.share_url || '')
          .trim()
          .replace(/^.*?(https?:\/\S+)/i, '$1')
          .trim();
        const url =
          shareUrl ||
          String(h.summary || '')
            .split('\n')
            .map((line: string) => line.trim())
            .find((line: string) => /^https?:\/\//i.test(line)) ||
          '';
        const expiresAt = String(h.expires_at || '').trim() || null;
        pushPricingShareActivity(items, pricingShareSeen, {
          id: `hist-${leadId}-${i}`,
          at,
          url,
          expiresAt,
          by: String(h.by_name || h.by || '').trim() || null,
        });
        continue;
      }
      const isMerge = event === 'PHONE_DUPLICATE_MERGED';
      if (isMerge && h.previous_label) histMergeIds.add(String(h.previous_label));
      const statusLabel = friendlyPipelineStatus(h.status || h.previous_status);
      const summaryLines = String(h.summary || '')
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean);
      const statusLine = summaryLines.find((line) => /^status\b/i.test(line)) || '';
      const detailLines = summaryLines.filter((line) => line !== statusLine);
      const isFieldLog = event === 'FIELDS' || String(h.summary || '').includes('→');
      const histBody = isFieldLog
        ? detailLines.join('\n') || null
        : isMerge
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
          : statusLine
            ? statusLine
            : isFieldLog
              ? 'Details updated'
              : String(h.summary || h.event || 'History').slice(0, 160),
        body: histBody,
        meta: {
          event: h.event || null,
          status: h.status || null,
          status_label: statusLabel,
          workshop_name: h.workshop_name || null,
          remark: h.remark || null,
          by: String(h.by_name || h.by || '').trim() || null,
        },
      });
    }

    const ps = meta.pricing_share;
    if (ps && typeof ps === 'object') {
      const url = normalizePricingShareUrl(String((ps as any).url || ''));
      const expiresAt = String((ps as any).expires_at || '').trim() || null;
      const at =
        String(meta.pricing_whatsapp_sent_at || '').trim() ||
        String((ps as any).sent_at || '').trim() ||
        '';
      if (url && at) {
        pushPricingShareActivity(items, pricingShareSeen, {
          id: `pricing-meta-${leadId}`,
          at,
          url,
          expiresAt,
          by: null,
        });
      }
    }

    for (const row of shareLinksRes.data || []) {
      const slug = String((row as any).slug || '').trim();
      const url = slug ? pricingSharePublicUrl(slug) : '';
      const at = String((row as any).created_at || '').trim();
      const expiresAt = String((row as any).expires_at || '').trim() || null;
      if (url && at) {
        pushPricingShareActivity(items, pricingShareSeen, {
          id: `pricing-link-${String((row as any).id || slug)}`,
          at,
          url,
          expiresAt,
          by: null,
        });
      }
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

    const checkoutIndex = buildCheckoutLeadIndex([lead as any, ...siblingLeads]);
    const checkoutParentId = checkoutIndex.childToParentId.get(leadId) || leadId;
    const checkoutPairIds = new Set<string>(
      (checkoutIndex.siblingsByParentId.get(checkoutParentId) || []).map((row) => String(row.id || '')),
    );
    if (checkoutParentId !== leadId) checkoutPairIds.add(checkoutParentId);

    for (const sib of siblingLeads) {
      if (sib?.deleted_at) continue;
      const leadNo = String(sib.lead_number || sib.id || '');
      const vehicle = [sib.vehicle_make, sib.vehicle_model, sib.vehicle_number]
        .map((v) => String(v || '').trim())
        .filter((v) => v && v.toUpperCase() !== 'NA')
        .join(' · ');
      const isCheckoutPair = checkoutPairIds.has(String(sib.id));
      const statusLabel = isCheckoutPair ? crmStatusLabel(sib) : friendlyPipelineStatus(sib.status);
      const serviceName = isAdminCustomRepairLead(sib)
        ? 'Custom Repair'
        : checkoutServiceName(sib);
      items.push({
        id: `sib-${sib.id}`,
        kind: 'booking',
        at: String(sib.created_at || sib.updated_at || new Date().toISOString()),
        title: isCheckoutPair ? `${serviceName} · ${statusLabel}` : `Other booking · #${leadNo} · ${statusLabel}`,
        body: isCheckoutPair
          ? [leadNo ? `Lead # ${leadNo}` : null, vehicle || null].filter(Boolean).join('\n')
          : [vehicle || null, `Status: ${statusLabel}`].filter(Boolean).join('\n'),
        meta: {
          status: sib.status,
          status_label: statusLabel,
          lead_number: leadNo,
          lead_id: String(sib.id),
          checkout_pair: isCheckoutPair,
        },
      });
    }

    for (const ev of eventsRes.data || []) {
      const evType = String((ev as any).event_type || '').toLowerCase();
      const actor = String((ev as any).actor_name || '').trim();
      const desc = String((ev as any).event_description || (ev as any).description || '').trim();
      let title = desc || String((ev as any).event_type || 'Event').replace(/_/g, ' ');
      if (/assign|reassign/.test(evType)) {
        title = desc || (actor ? `Lead assigned to ${actor}` : title);
      } else if (/created|manual|add/.test(evType) && actor) {
        title = desc || `Lead added by ${actor}`;
      } else if (/tag/.test(evType)) {
        title = desc || `Lead tag · ${title}`;
      }
      items.push({
        id: `evt-${(ev as any).id}`,
        kind: 'system',
        at: String((ev as any).created_at),
        title,
        body: desc && desc !== title ? desc : null,
        meta: {
          event: (ev as any).event_type,
          by: actor || null,
          ...(typeof (ev as any).metadata === 'object' && (ev as any).metadata
            ? (ev as any).metadata
            : {}),
        },
      });
    }

    const crmId = resolveAdminCrmStatusId(lead);
    const crmLabel = crmStatusLabel(lead);
    const dispAt = String(
      meta.last_call_at || (lead as any).updated_at || (lead as any).created_at || '',
    );
    const dispRemark =
      String((lead as any).telecaller_remarks || meta.telecaller_remarks || '').trim() || null;
    if (crmId && crmId !== 'FRESH' && dispAt) {
      const dispTs = Date.parse(dispAt);
      const alreadyLogged = items.some((it) => {
        const title = String(it.title || '').toLowerCase();
        const status = String(it.meta?.status || '').toUpperCase();
        const itTs = Date.parse(String(it.at || ''));
        const closeInTime =
          Number.isFinite(dispTs) &&
          Number.isFinite(itTs) &&
          Math.abs(itTs - dispTs) < 3 * 60 * 1000;
        return (
          status === crmId ||
          title.includes(`lead updated · ${crmLabel.toLowerCase()}`) ||
          (closeInTime && (title.includes(crmLabel.toLowerCase()) || /\bringing\b/.test(title)))
        );
      });
      if (!alreadyLogged) {
        items.push({
          id: `disp-${leadId}`,
          kind: 'system',
          at: dispAt,
          title: `Lead updated · ${crmLabel}`,
          body: dispRemark,
          meta: { status: crmId, status_label: crmLabel },
        });
      }
    }

    const AUTO_ACTOR_SKIP =
      /\b(waca|misa|whatsapp_admin|template|api\s*request|smartflo|pricing\s*sent)\b/i;
    for (const it of items) {
      if (String(it.meta?.by || '').trim()) continue;
      if (it.meta?.transfer) continue;
      const hay = `${it.title} ${it.body || ''}`;
      const msgType = String(it.meta?.message_type || '').toLowerCase();
      if (it.kind === 'whatsapp' && msgType && msgType !== 'text' && AUTO_ACTOR_SKIP.test(hay)) {
        continue;
      }
      if (AUTO_ACTOR_SKIP.test(hay) && it.kind !== 'call' && it.kind !== 'whatsapp') continue;
      const owner = leadOwnerAt(ownerSegments, it.at);
      if (owner?.name) {
        it.meta = { ...(it.meta || {}), by: owner.name };
      }
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
