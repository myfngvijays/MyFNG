import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';
import {
  getMisaCreatedFrom,
  getMisaLeadSource,
  getMisaOtpVerifiedLabel,
  resolveMisaBookingChannel,
  resolveMisaOtpTagNames,
  type MisaBookingChannel,
} from '@/lib/chatbot_v2/misaLeadSource';
import type { LeadDistributionChannelId } from '@/lib/enquiry/leadChannels';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';
import { addLeadTags, ensureTagIdsByNames, mergeLeadTagsFromLosers } from '@/lib/telecaller/crmLeadTagsApply';

export type LeadHistoryEntry = {
  at: string;
  summary: string;
  remark?: string | null;
  status?: string | null;
  event?: string | null;
  previous_status?: string | null;
  previous_label?: string | null;
  workshop_name?: string | null;
  city?: string | null;
  pincode?: string | null;
};

/** Prepend a user-level history row (TeleCRM-style timeline). */
export function appendLeadProfileHistory(
  couponMeta: Record<string, unknown> | null | undefined,
  entry: LeadHistoryEntry,
): Record<string, unknown> {
  const base =
    couponMeta && typeof couponMeta === 'object' && !Array.isArray(couponMeta)
      ? { ...couponMeta }
      : {};
  const prev = Array.isArray(base.profile_history) ? (base.profile_history as LeadHistoryEntry[]) : [];
  base.profile_history = [entry, ...prev].slice(0, 50);
  return base;
}

function phoneOrFilter(phone10: string): string {
  return `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10},customer_phone.ilike.%${phone10}`;
}

/**
 * Canonical CRM lead for this phone = oldest non-deleted row.
 * Rebooks merge onto this lead (TeleCRM phone merge) so history stays in one place.
 */
export async function findLatestServiceLeadByPhone(
  supabaseAdmin: any,
  phone: string | null | undefined,
): Promise<any | null> {
  const phone10 = normalizeCustomerPhone(phone);
  if (!phone10) return null;

  const selectCols =
    'id, lead_number, status, is_incomplete, coupon_meta, meta, reopen_count, assigned_telecaller_id, customer_name, customer_phone, created_at, updated_at';

  let query = supabaseAdmin
    .from('service_leads')
    .select(selectCols)
    .or(phoneOrFilter(phone10))
    .order('created_at', { ascending: true })
    .limit(1);

  query = query.is('deleted_at', null);

  let { data, error } = await query.maybeSingle();
  if (error && /deleted_at|is_incomplete/i.test(String(error.message || ''))) {
    const fallbackCols = selectCols
      .replace(', is_incomplete', '')
      .replace('is_incomplete, ', '');
    let retry = supabaseAdmin
      .from('service_leads')
      .select(fallbackCols)
      .or(phoneOrFilter(phone10))
      .order('created_at', { ascending: true })
      .limit(1);
    if (!/deleted_at/i.test(String(error.message || ''))) {
      retry = retry.is('deleted_at', null);
    }
    ({ data, error } = await retry.maybeSingle());
  }

  if (error) {
    console.warn('[service-lead-reopen] find failed:', error.message);
    return null;
  }
  return data || null;
}

export function isPlaceholderCustomerName(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n || n.length < 2) return true;
  if (/^customer[_\s-]?\d*$/i.test(n)) return true;
  if (/^whatsapp\s*customer$/i.test(n)) return true;
  return false;
}

export function looksLikePersonName(raw: string | null | undefined): boolean {
  const t = String(raw || '').trim();
  if (t.length < 2 || t.length > 60) return false;
  if (isPlaceholderCustomerName(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (!/^[a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.'-]{1,59}$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if (
    /^(yes|no|ok|okay|hi|hello|hey|cancel|book|booking|pricing|help|thanks|thank you|address|pincode|otp)$/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Persist real customer name on the canonical CRM lead for this phone
 * (replaces Customer_XXXX placeholders from OTP stub leads).
 */
export async function updateLeadCustomerNameByPhone(
  supabaseAdmin: any,
  phone: string | null | undefined,
  customerName: string,
): Promise<{ updated: boolean; leadId: string | null; name: string | null }> {
  const phone10 = normalizeCustomerPhone(phone);
  const name = String(customerName || '').trim().slice(0, 120);
  if (!phone10 || !looksLikePersonName(name)) {
    return { updated: false, leadId: null, name: null };
  }

  const lead = await findLatestServiceLeadByPhone(supabaseAdmin, phone10);
  if (!lead?.id) {
    return { updated: false, leadId: null, name };
  }

  const existing = String(lead.customer_name || '').trim();
  if (existing && !isPlaceholderCustomerName(existing) && existing.toLowerCase() === name.toLowerCase()) {
    return { updated: false, leadId: String(lead.id), name: existing };
  }

  // Don't overwrite a real different name unless current is placeholder.
  if (existing && !isPlaceholderCustomerName(existing) && existing.toLowerCase() !== name.toLowerCase()) {
    return { updated: false, leadId: String(lead.id), name: existing };
  }

  const nowIso = new Date().toISOString();
  const prevMeta =
    lead.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  const nextMeta = appendLeadProfileHistory(
    {
      ...prevMeta,
      customer_name_captured_at: nowIso,
      customer_name_source: 'misa_chat',
    },
    {
      at: nowIso,
      summary: `Customer name saved: ${name}`,
      status: String(lead.status || '') || null,
      event: 'CUSTOMER_NAME_CAPTURED',
      previous_label: existing || null,
    },
  );

  const { error } = await supabaseAdmin
    .from('service_leads')
    .update({
      customer_name: name,
      coupon_meta: nextMeta,
      updated_at: nowIso,
    })
    .eq('id', lead.id);

  if (error) {
    console.warn('[service-lead-reopen] name update failed:', error.message);
    return { updated: false, leadId: String(lead.id), name };
  }

  return { updated: true, leadId: String(lead.id), name };
}

/** Soft-delete other leads for same phone (keep keeper). Skip active workshop jobs. */
async function softDeleteSiblingLeads(
  supabaseAdmin: any,
  phone10: string,
  keeperId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const skipStatuses = new Set(['IN_PROGRESS', 'ACCEPTED', 'ASSIGNED', 'ASSIGNED_TO_WORKSHOP']);
  try {
    const { data: siblings } = await supabaseAdmin
      .from('service_leads')
      .select('id, status')
      .or(phoneOrFilter(phone10))
      .neq('id', keeperId)
      .is('deleted_at', null)
      .limit(30);

    const ids = (siblings || [])
      .filter((r: any) => !skipStatuses.has(String(r.status || '').toUpperCase()))
      .map((r: any) => r.id)
      .filter(Boolean);
    if (!ids.length) return;

    await supabaseAdmin
      .from('service_leads')
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .in('id', ids);
  } catch (err) {
    console.warn('[service-lead-reopen] sibling cleanup skipped:', err);
  }
}

export type UpsertBookingLeadResult = {
  lead: { id: string; lead_number: string };
  created: boolean;
  previousStatus: string | null;
  previousLabel: string | null;
};

/**
 * TeleCRM-style: booking updates the existing phone lead (Lost → Fresh/Booking confirmed)
 * with user history, instead of inserting a duplicate row.
 */
function bookingDistChannel(
  payload: Record<string, unknown>,
): 'MISA' | 'APP_BOOKING' | 'WEBSITE_BOOKING' {
  const hay = `${payload.created_from || ''} ${payload.lead_source || ''}`.toUpperCase();
  if (/MISA/.test(hay)) return 'MISA';
  if (/MOBILE|APP/.test(hay)) return 'APP_BOOKING';
  return 'WEBSITE_BOOKING';
}

export async function upsertBookingServiceLead(
  supabaseAdmin: any,
  input: {
    phone: string;
    leadPayload: Record<string, unknown>;
    bookingSummary?: string | null;
  },
): Promise<UpsertBookingLeadResult> {
  const phone10 = normalizeCustomerPhone(input.phone);
  if (!phone10) {
    throw new Error('Invalid customer phone');
  }

  const nowIso = new Date().toISOString();
  const existing = await findLatestServiceLeadByPhone(supabaseAdmin, phone10);
  const bookingSummary = String(input.bookingSummary || 'App/Web booking').trim();

  if (!existing?.id) {
    const payload: Record<string, unknown> = { ...input.leadPayload };
    // service_leads has no assignment_mode column (enquiry_hub does) — keep mode in coupon_meta only
    delete payload.assignment_mode;
    if (!payload.assigned_telecaller_id) {
      try {
        const picked = await pickTelecallerWeightedRoundRobin(
          bookingDistChannel(payload),
          payload.pincode ? String(payload.pincode) : null,
        );
        if (picked.telecallerId) {
          payload.assigned_telecaller_id = picked.telecallerId;
          payload.assigned_at = nowIso;
          const prevMeta =
            payload.coupon_meta && typeof payload.coupon_meta === 'object'
              ? (payload.coupon_meta as Record<string, unknown>)
              : {};
          payload.coupon_meta = { ...prevMeta, assignment_mode: 'AUTO' };
        }
      } catch {
        /* distribution optional — booking still succeeds */
      }
    }
    const { data: inserted, error } = await supabaseAdmin
      .from('service_leads')
      .insert(payload)
      .select('id, lead_number')
      .single();
    if (error || !inserted) {
      throw new Error(error?.message || 'Booking lead insert failed');
    }
    void notifyTelecallerNewLeadAssignedSafe({
      leadId: inserted.id,
      leadNumber: inserted.lead_number,
      telecallerId: payload.assigned_telecaller_id ? String(payload.assigned_telecaller_id) : null,
      assignedByName: 'Auto distribution',
      notes: bookingSummary || 'New booking lead',
    });
    return {
      lead: { id: inserted.id, lead_number: inserted.lead_number },
      created: true,
      previousStatus: null,
      previousLabel: null,
    };
  }

  const previousStatus = String(existing.status || '').toUpperCase() || null;
  const prevMeta =
    existing.coupon_meta && typeof existing.coupon_meta === 'object'
      ? (existing.coupon_meta as Record<string, unknown>)
      : {};
  const previousLabel =
    String(prevMeta.last_call_label || prevMeta.last_lost_reason || previousStatus || '').trim() ||
    null;

  const wasLost =
    previousStatus === 'REJECTED' ||
    String(prevMeta.last_call_result || '').toUpperCase() === 'LOST';
  const wasOtpIncomplete =
    String(prevMeta.last_call_result || '').toUpperCase() === 'OTP_VERIFIED' ||
    Boolean(prevMeta.otp_verified_at) ||
    (Boolean(existing.is_incomplete) && previousStatus === 'NEW');

  const historySummary = wasLost
    ? `Rebooked — was Lost${previousLabel && previousLabel.toLowerCase().includes('lost') ? '' : previousLabel ? ` · ${previousLabel}` : ''} → Booking confirmed`
    : wasOtpIncomplete
      ? 'Booking completed after website OTP verify'
      : `Rebooked on existing lead → Booking confirmed`;

  const nextCouponMeta = appendLeadProfileHistory(
    {
      ...prevMeta,
      ...(input.leadPayload.coupon_meta && typeof input.leadPayload.coupon_meta === 'object'
        ? (input.leadPayload.coupon_meta as Record<string, unknown>)
        : {}),
      last_call_result: 'BOOKING_CONFIRMED',
      last_call_label: 'Booking confirmed',
      last_lost_reason: null,
      last_call_at: nowIso,
      last_call_status: 'ANSWERED',
      website_booking_abandoned: false,
    },
    {
      at: nowIso,
      summary: historySummary,
      remark: bookingSummary,
      status: 'BOOKING_CONFIRMED',
      event: wasOtpIncomplete ? 'OTP_BOOKING_COMPLETED' : 'REBOOK',
      previous_status: previousStatus,
      previous_label: previousLabel,
    },
  );

  const prevMetaObj =
    existing.meta && typeof existing.meta === 'object' ? (existing.meta as Record<string, unknown>) : {};
  const nextMeta =
    input.leadPayload.meta && typeof input.leadPayload.meta === 'object'
      ? { ...prevMetaObj, ...(input.leadPayload.meta as Record<string, unknown>) }
      : prevMetaObj;

  const reopenCount = Number(existing.reopen_count || 0) + 1;

  // Don't overwrite lead_number — keep original CRM identity
  const {
    lead_number: _dropLeadNumber,
    created_at: _dropCreatedAt,
    ...restPayload
  } = input.leadPayload;

  const patch: Record<string, unknown> = {
    ...restPayload,
    status: 'VALIDATED',
    is_incomplete: false,
    coupon_meta: nextCouponMeta,
    meta: nextMeta,
    reopen_count: reopenCount,
    updated_at: nowIso,
    deleted_at: null,
  };
  // Never write enquiry_hub-only columns onto service_leads
  delete patch.assignment_mode;

  const bookingPincode =
    input.leadPayload.pincode != null
      ? String(input.leadPayload.pincode)
      : existing.pincode
        ? String(existing.pincode)
        : null;
  const previousAssignee = existing.assigned_telecaller_id
    ? String(existing.assigned_telecaller_id)
    : null;
  if (bookingPincode && !input.leadPayload.assigned_telecaller_id && !previousAssignee) {
    try {
      const picked = await pickTelecallerWeightedRoundRobin(
        bookingDistChannel(input.leadPayload),
        bookingPincode,
      );
      if (picked.telecallerId) {
        patch.assigned_telecaller_id = picked.telecallerId;
        patch.assigned_at = nowIso;
        patch.coupon_meta = {
          ...(typeof patch.coupon_meta === 'object' && patch.coupon_meta
            ? (patch.coupon_meta as Record<string, unknown>)
            : {}),
          assignment_mode: 'AUTO',
        };
      }
    } catch {
      /* distribution optional */
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('service_leads')
    .update(patch)
    .eq('id', existing.id)
    .select('id, lead_number')
    .single();

  if (updateError || !updated) {
    // reopen_count / deleted_at may be missing on older schemas — retry slim
    if (updateError && /reopen_count|deleted_at|is_incomplete/i.test(updateError.message || '')) {
      const slim = { ...patch };
      delete slim.reopen_count;
      delete slim.deleted_at;
      delete slim.is_incomplete;
      delete slim.assignment_mode;
      const retry = await supabaseAdmin
        .from('service_leads')
        .update(slim)
        .eq('id', existing.id)
        .select('id, lead_number')
        .single();
      if (retry.error || !retry.data) {
        throw new Error(retry.error?.message || updateError.message || 'Lead reopen failed');
      }
      await softDeleteSiblingLeads(supabaseAdmin, phone10, retry.data.id);
      void notifyTelecallerNewLeadAssignedSafe({
        leadId: retry.data.id,
        leadNumber: retry.data.lead_number,
        telecallerId: patch.assigned_telecaller_id
          ? String(patch.assigned_telecaller_id)
          : input.leadPayload.assigned_telecaller_id
            ? String(input.leadPayload.assigned_telecaller_id)
            : null,
        previousTelecallerId: previousAssignee,
        assignedByName: 'Auto distribution',
        notes: bookingSummary || 'Booking confirmed',
      });
      return {
        lead: { id: retry.data.id, lead_number: retry.data.lead_number },
        created: false,
        previousStatus,
        previousLabel,
      };
    }
    throw new Error(updateError?.message || 'Lead reopen failed');
  }

  await softDeleteSiblingLeads(supabaseAdmin, phone10, updated.id);

  void notifyTelecallerNewLeadAssignedSafe({
    leadId: updated.id,
    leadNumber: updated.lead_number,
    telecallerId: patch.assigned_telecaller_id
      ? String(patch.assigned_telecaller_id)
      : input.leadPayload.assigned_telecaller_id
        ? String(input.leadPayload.assigned_telecaller_id)
        : null,
    previousTelecallerId: previousAssignee,
    assignedByName: 'Auto distribution',
    notes: bookingSummary || 'Booking confirmed',
  });

  return {
    lead: { id: updated.id, lead_number: updated.lead_number },
    created: false,
    previousStatus,
    previousLabel,
  };
}

const ACTIVE_BOOKING_STATUSES = new Set([
  'VALIDATED',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'ASSIGNED_TO_WORKSHOP',
  'COMPLETED',
]);

export type EnsureOtpVerifiedLeadResult = {
  leadId: string | null;
  leadNumber: string | null;
  created: boolean;
  skipped?: string | null;
};

function isWebsiteOtpIncompleteLead(row: any): boolean {
  if (!row?.id) return false;
  const status = String(row.status || '').toUpperCase();
  if (ACTIVE_BOOKING_STATUSES.has(status)) return false;
  const meta =
    row.coupon_meta && typeof row.coupon_meta === 'object'
      ? (row.coupon_meta as Record<string, unknown>)
      : {};
  const otpFlag =
    Boolean(meta.website_otp_verified) ||
    Boolean(meta.website_booking_abandoned) ||
    String(meta.last_call_result || '').toUpperCase() === 'OTP_VERIFIED';
  const incomplete = row.is_incomplete === true || status === 'NEW' || status === 'REJECTED';
  return otpFlag && incomplete;
}

const OTP_STUB_REUSE_MS = 2 * 60 * 60 * 1000; // same-session re-verify within 2h

/** Newest open website-OTP incomplete stub for this phone (if any). */
async function findOpenWebsiteOtpLead(
  supabaseAdmin: any,
  phone10: string,
  opts?: { onlyRecent?: boolean },
): Promise<any | null> {
  try {
    let query = supabaseAdmin
      .from('service_leads')
      .select(
        'id, lead_number, status, is_incomplete, coupon_meta, customer_name, customer_phone, assigned_telecaller_id, created_at, updated_at',
      )
      .or(phoneOrFilter(phone10))
      .order('updated_at', { ascending: false })
      .limit(15);
    query = query.is('deleted_at', null);
    let { data, error } = await query;
    if (error && /deleted_at|is_incomplete/i.test(String(error.message || ''))) {
      ({ data, error } = await supabaseAdmin
        .from('service_leads')
        .select('id, lead_number, status, coupon_meta, customer_name, customer_phone, assigned_telecaller_id, created_at, updated_at')
        .or(phoneOrFilter(phone10))
        .order('updated_at', { ascending: false })
        .limit(15));
    }
    if (error) {
      console.warn('[ensureWebsiteOtpVerifiedLead] find open otp stub failed:', error.message);
      return null;
    }
    const now = Date.now();
    return (
      (data || []).find((row: any) => {
        if (!isWebsiteOtpIncompleteLead(row)) return false;
        if (!opts?.onlyRecent) return true;
        const t = new Date(row.updated_at || row.created_at || 0).getTime();
        return Number.isFinite(t) && now - t <= OTP_STUB_REUSE_MS;
      }) || null
    );
  } catch (err) {
    console.warn('[ensureWebsiteOtpVerifiedLead] find open otp stub error:', err);
    return null;
  }
}

async function softDeleteStaleWebsiteOtpStubs(
  supabaseAdmin: any,
  phone10: string,
  keepId: string | null,
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from('service_leads')
      .select('id, status, is_incomplete, coupon_meta')
      .or(phoneOrFilter(phone10))
      .is('deleted_at', null)
      .limit(20);
    const { data, error } = await query;
    if (error || !data?.length) return;
    const nowIso = new Date().toISOString();
    const ids = data
      .filter((row: any) => isWebsiteOtpIncompleteLead(row) && String(row.id) !== String(keepId || ''))
      .map((row: any) => row.id)
      .filter(Boolean);
    if (!ids.length) return;
    await supabaseAdmin
      .from('service_leads')
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .in('id', ids);
  } catch (err) {
    console.warn('[ensureWebsiteOtpVerifiedLead] stale stub cleanup skipped:', err);
  }
}

export type BookingOtpChannel = 'WEB' | 'MOBILE';
export type OtpLeadOrigin = 'booking_form' | 'misa';

export type EnsureOtpVerifiedLeadOptions = {
  channel?: BookingOtpChannel;
  /** When 'misa', tags lead as MISA AI (Website/App/WhatsApp) instead of Website/App Booking. */
  origin?: OtpLeadOrigin;
  misaChannel?: MisaBookingChannel;
};

function resolveMisaChannel(options?: EnsureOtpVerifiedLeadOptions): MisaBookingChannel {
  if (options?.misaChannel) return options.misaChannel;
  return options?.channel === 'MOBILE' ? 'APP' : 'WEBSITE';
}

async function applyOtpVerifiedLeadTags(
  leadId: string | null | undefined,
  channel: BookingOtpChannel,
  options?: EnsureOtpVerifiedLeadOptions,
): Promise<void> {
  const id = String(leadId || '').trim();
  if (!id) return;
  try {
    if (options?.origin === 'misa') {
      const misaChannel = resolveMisaChannel(options);
      const { parent, names } = resolveMisaOtpTagNames(misaChannel);
      const tagIds = await ensureTagIdsByNames(names, { parentName: parent });
      if (tagIds.length) await addLeadTags(id, tagIds);
      return;
    }
    // Non-MISA booking OTP: keep Website / App Booking source tags distinct from MISA OTP
    const name = channel === 'MOBILE' ? 'Mob OTP Verified' : 'Web OTP Verified';
    const tagIds = await ensureTagIdsByNames([name]);
    if (tagIds.length) await addLeadTags(id, tagIds);
  } catch (err) {
    console.warn('[ensureWebsiteOtpVerifiedLead] tag apply skipped:', err);
  }
}

function otpChannelMeta(channel: BookingOtpChannel, options?: EnsureOtpVerifiedLeadOptions) {
  const isMisa = options?.origin === 'misa';
  if (isMisa) {
    const misaChannel = resolveMisaChannel(options);
    const leadSource = getMisaLeadSource(misaChannel);
    const otpLabel = getMisaOtpVerifiedLabel(misaChannel);
    const createdFromRaw = getMisaCreatedFrom(misaChannel);
    // DB allowlist historically prefers MOBILE_APP over APP
    const created_from =
      createdFromRaw === 'APP' ? 'MOBILE_APP' : createdFromRaw === 'WEB' ? 'WEB' : createdFromRaw;
    const historyEvent =
      misaChannel === 'WHATSAPP'
        ? 'MISA_OTP_VERIFIED_WHATSAPP'
        : misaChannel === 'APP'
          ? 'MISA_OTP_VERIFIED_APP'
          : 'MISA_OTP_VERIFIED_WEBSITE';
    return {
      otp_channel: channel,
      created_from,
      lead_source: leadSource,
      last_call_label: otpLabel,
      description: `${otpLabel} — booking incomplete`,
      problem_description: `OTP verified via ${leadSource}; booking not completed`,
      historySummary: `${otpLabel} — booking not completed yet`,
      historyEvent,
      distChannel: 'MISA' as LeadDistributionChannelId,
      misa_channel: misaChannel,
    };
  }

  const isMobile = channel === 'MOBILE';
  return {
    otp_channel: channel,
    created_from: isMobile ? 'MOBILE_APP' : 'WEB',
    lead_source: isMobile ? 'App Booking' : 'Website',
    last_call_label: isMobile ? 'Mob OTP Verified' : 'Web OTP Verified',
    description: isMobile
      ? 'App OTP verified — booking incomplete'
      : 'Website OTP verified — booking incomplete',
    problem_description: isMobile
      ? 'OTP verified on mobile app; booking form not submitted'
      : 'OTP verified on website; booking form not submitted',
    historySummary: isMobile
      ? 'App OTP verified — booking not completed yet'
      : 'Website OTP verified — booking not completed yet',
    historyEvent: isMobile ? 'MOBILE_OTP_VERIFIED' : 'WEBSITE_OTP_VERIFIED',
    distChannel: (isMobile ? 'APP_OTP' : 'WEBSITE_OTP') as LeadDistributionChannelId,
    misa_channel: null as MisaBookingChannel | null,
  };
}

/** Infer incomplete-lead tagging from otp_requests.metadata / request body. */
export function resolveOtpLeadOptionsFromSource(input: {
  source?: string | null;
  channelHint?: string | null;
  bookingChannel?: string | null;
  sessionId?: string | null;
  fallbackChannel?: BookingOtpChannel;
}): EnsureOtpVerifiedLeadOptions {
  const source = String(input.source || '').toLowerCase().trim();
  const bookingChannel = String(input.bookingChannel || input.channelHint || '')
    .toUpperCase()
    .trim();
  const fallback: BookingOtpChannel = input.fallbackChannel === 'MOBILE' ? 'MOBILE' : 'WEB';
  const sessionId = String(input.sessionId || '').trim();

  const isMisaSource =
    source.includes('misa') ||
    source.includes('chatbot') ||
    source === 'ai_booking' ||
    source === 'misa_booking';

  if (!isMisaSource) {
    return { origin: 'booking_form', channel: fallback };
  }

  let misaChannel: MisaBookingChannel = 'WEBSITE';
  if (
    source.includes('misa-app') ||
    source.includes('misa_app') ||
    bookingChannel === 'APP' ||
    bookingChannel === 'MOBILE' ||
    bookingChannel === 'MOBILE_APP'
  ) {
    misaChannel = 'APP';
  } else if (bookingChannel === 'WHATSAPP' || source.includes('whatsapp')) {
    misaChannel = 'WHATSAPP';
  } else if (bookingChannel === 'WEBSITE' || bookingChannel === 'WEB') {
    misaChannel = 'WEBSITE';
  } else if (sessionId) {
    // WhatsApp 6161 sessions are wa_* — keep them off Website MISA OTP
    misaChannel = resolveMisaBookingChannel({ sessionId });
  }

  return {
    origin: 'misa',
    channel: misaChannel === 'APP' ? 'MOBILE' : 'WEB',
    misaChannel,
  };
}

async function insertWebsiteOtpIncompleteLead(
  supabaseAdmin: any,
  phone10: string,
  nowIso: string,
  otpCouponMetaBase: Record<string, unknown>,
  channel: BookingOtpChannel = 'WEB',
  options?: EnsureOtpVerifiedLeadOptions,
): Promise<EnsureOtpVerifiedLeadResult> {
  const ch = otpChannelMeta(channel, options);
  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const couponMeta = appendLeadProfileHistory(otpCouponMetaBase, {
    at: nowIso,
    summary: ch.historySummary,
    status: 'OTP_VERIFIED',
    event: ch.historyEvent,
  });

  let assignedId: string | null = null;
  try {
    const picked = await pickTelecallerWeightedRoundRobin(ch.distChannel);
    assignedId = picked.telecallerId || null;
  } catch (err) {
    console.warn('[ensureWebsiteOtpVerifiedLead] insert assign failed:', err);
  }

  const basePayload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: ch.lead_source,
    created_from: ch.created_from,
    status: 'NEW',
    customer_name: `Customer_${phone10.slice(-4)}`,
    customer_phone: phone10,
    vehicle_number: 'NA',
    service_type: 'CAR_SERVICE',
    description: ch.description,
    problem_description: ch.problem_description,
    is_incomplete: true,
    lead_priority: 'NORMAL',
    assigned_telecaller_id: assignedId,
    assigned_at: assignedId ? nowIso : null,
    coupon_meta: couponMeta,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const tryInsert = async (payload: Record<string, unknown>) =>
    supabaseAdmin.from('service_leads').insert([payload]).select('id, lead_number').maybeSingle();

  let { data: inserted, error: insertErr } = await tryInsert(basePayload);

  if (insertErr) {
    console.warn('[ensureWebsiteOtpVerifiedLead] insert retry slim:', insertErr.message);
    const slim = { ...basePayload };
    delete slim.is_incomplete;
    delete slim.lead_priority;
    delete slim.problem_description;
    delete slim.description;
    delete slim.assigned_telecaller_id;
    ({ data: inserted, error: insertErr } = await tryInsert(slim));
  }

  if (insertErr && /created_from|check constraint/i.test(insertErr.message || '')) {
    const fallback = { ...basePayload, created_from: 'API' };
    delete fallback.is_incomplete;
    delete fallback.lead_priority;
    ({ data: inserted, error: insertErr } = await tryInsert(fallback));
  }

  if (insertErr || !inserted?.id) {
    console.error('[ensureWebsiteOtpVerifiedLead] insert failed:', insertErr?.message);
    return {
      leadId: null,
      leadNumber: null,
      created: false,
      skipped: insertErr?.message || 'insert_failed',
    };
  }

  void notifyTelecallerNewLeadAssignedSafe({
    leadId: String(inserted.id),
    leadNumber: String(inserted.lead_number || leadNumber),
    telecallerId: assignedId,
    assignedByName: 'Auto distribution',
    notes: ch.last_call_label || 'OTP verified lead',
  });

  void applyOtpVerifiedLeadTags(String(inserted.id), channel, options);

  return {
    leadId: String(inserted.id),
    leadNumber: String(inserted.lead_number || leadNumber),
    created: true,
  };
}

/**
 * After booking OTP verify (web, mobile, or MISA): create/refresh an incomplete lead so it
 * shows in admin bookings + telecaller CRM even if booking is abandoned.
 * Never overwrites an existing active booking — inserts a separate OTP stub instead.
 */
export async function ensureWebsiteOtpVerifiedLead(
  supabaseAdmin: any,
  phone: string | null | undefined,
  options?: EnsureOtpVerifiedLeadOptions,
): Promise<EnsureOtpVerifiedLeadResult> {
  const phone10 = normalizeCustomerPhone(phone);
  if (!phone10) {
    return { leadId: null, leadNumber: null, created: false, skipped: 'invalid_phone' };
  }

  const channel: BookingOtpChannel =
    options?.channel === 'MOBILE' || options?.misaChannel === 'APP' ? 'MOBILE' : 'WEB';
  const ch = otpChannelMeta(channel, options);
  const nowIso = new Date().toISOString();
  const otpCouponMetaBase = {
    last_call_result: 'OTP_VERIFIED',
    last_call_label: ch.last_call_label,
    last_call_at: nowIso,
    last_call_status: 'ANSWERED',
    otp_verified_at: nowIso,
    otp_channel: channel,
    website_otp_verified: true,
    website_booking_abandoned: true,
    misa_otp_verified: options?.origin === 'misa',
    misa_channel: ch.misa_channel,
  };

  // Reuse only a *recent* OTP stub (same session). Older stubs sit mid-list by created_at
  // — insert a fresh lead so it appears at the top of admin bookings.
  const openStub = await findOpenWebsiteOtpLead(supabaseAdmin, phone10, { onlyRecent: true });
  if (openStub?.id) {
    const prevMeta =
      openStub.coupon_meta && typeof openStub.coupon_meta === 'object'
        ? (openStub.coupon_meta as Record<string, unknown>)
        : {};
    const nextMeta = appendLeadProfileHistory(
      {
        ...prevMeta,
        ...otpCouponMetaBase,
        last_lost_reason: null,
      },
      {
        at: nowIso,
        summary: `${ch.historySummary} (again)`,
        status: 'OTP_VERIFIED',
        event: ch.historyEvent,
        previous_status: String(openStub.status || '') || null,
      },
    );

    let assignedId: string | null = null;
    try {
      const picked = await pickTelecallerWeightedRoundRobin(ch.distChannel);
      assignedId = picked.telecallerId || null;
    } catch (err) {
      console.warn('[ensureWebsiteOtpVerifiedLead] assign failed:', err);
    }

    const previousAssignee = openStub.assigned_telecaller_id
      ? String(openStub.assigned_telecaller_id)
      : null;

    const patch: Record<string, unknown> = {
      status: 'NEW',
      is_incomplete: true,
      created_from: ch.created_from,
      lead_source: ch.lead_source,
      assigned_telecaller_id: assignedId,
      assigned_at: assignedId ? nowIso : null,
      coupon_meta: nextMeta,
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null,
      description: ch.description,
      service_type: 'CAR_SERVICE',
      customer_name: openStub.customer_name || `Customer_${phone10.slice(-4)}`,
    };

    let { error: updateError } = await supabaseAdmin
      .from('service_leads')
      .update(patch)
      .eq('id', openStub.id);

    if (
      updateError &&
      /is_incomplete|deleted_at|created_from|description|service_type|created_at|assigned_/i.test(
        updateError.message || '',
      )
    ) {
      const slim = { ...patch };
      delete slim.is_incomplete;
      delete slim.deleted_at;
      delete slim.description;
      delete slim.created_at;
      delete slim.assigned_at;
      ({ error: updateError } = await supabaseAdmin
        .from('service_leads')
        .update(slim)
        .eq('id', openStub.id));
    }

    if (!updateError) {
      void notifyTelecallerNewLeadAssignedSafe({
        leadId: String(openStub.id),
        leadNumber: String(openStub.lead_number || '') || null,
        telecallerId: assignedId,
        previousTelecallerId: previousAssignee,
        assignedByName: 'Auto distribution',
        notes: ch.last_call_label || 'OTP verified lead',
      });
      void applyOtpVerifiedLeadTags(String(openStub.id), channel, options);
      return {
        leadId: String(openStub.id),
        leadNumber: String(openStub.lead_number || '') || null,
        created: false,
        skipped: 'refreshed_otp_stub',
      };
    }
    console.warn('[ensureWebsiteOtpVerifiedLead] stub refresh failed, inserting new:', updateError.message);
  }

  const inserted = await insertWebsiteOtpIncompleteLead(
    supabaseAdmin,
    phone10,
    nowIso,
    otpCouponMetaBase,
    channel,
    options,
  );
  if (inserted.leadId) {
    await softDeleteStaleWebsiteOtpStubs(supabaseAdmin, phone10, inserted.leadId);
  }
  return inserted;
}

/** Prefer actionable OTP/incomplete/NEW over Lost/Done when collapsing by phone. */
function leadDedupeRank(row: any): number {
  const status = String(row?.status || '').toUpperCase();
  const meta =
    row?.coupon_meta && typeof row.coupon_meta === 'object'
      ? (row.coupon_meta as Record<string, unknown>)
      : {};
  const otp =
    String(meta.last_call_result || '').toUpperCase() === 'OTP_VERIFIED' ||
    Boolean(meta.website_otp_verified) ||
    Boolean(meta.website_booking_abandoned) ||
    Boolean(row?.is_incomplete);
  if (otp && (status === 'NEW' || row?.is_incomplete)) return 100;
  if (status === 'IN_PROGRESS' || status === 'ACCEPTED' || status === 'ASSIGNED') return 95;
  if (status === 'NEW' || status === 'CONTACTED') return 80;
  if (status === 'VALIDATED') return 70;
  if (status === 'REJECTED' || status === 'COMPLETED' || status === 'CANCELLED') return 10;
  return 40;
}

function leadRecencyMs(row: any): number {
  return new Date(row?.updated_at || row?.created_at || 0).getTime() || 0;
}

/**
 * Collapse CRM list to one row per phone.
 * Prefer latest activity; among equal times, prefer chaseable / active ranks.
 */
export function dedupeLeadsByPhone<T extends { customer_phone?: string | null; updated_at?: string | null; created_at?: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const sorted = [...rows].sort((a, b) => {
    const timeDiff = leadRecencyMs(b) - leadRecencyMs(a);
    if (timeDiff !== 0) return timeDiff;
    return leadDedupeRank(b) - leadDedupeRank(a);
  });
  for (const row of sorted) {
    const key = normalizeCustomerPhone(row.customer_phone) || `id:${(row as any).id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

const ACTIVE_JOB_STATUSES = new Set([
  'IN_PROGRESS',
  'ACCEPTED',
  'ASSIGNED',
  'ASSIGNED_TO_WORKSHOP',
]);

function pickCanonicalLeadForPhone(siblings: any[]): any | null {
  if (!siblings.length) return null;
  const active = siblings.filter((r) =>
    ACTIVE_JOB_STATUSES.has(String(r.status || '').toUpperCase()),
  );
  const pool = active.length ? active : siblings;
  return [...pool].sort((a, b) => {
    const timeDiff = leadRecencyMs(b) - leadRecencyMs(a);
    if (timeDiff !== 0) return timeDiff;
    return leadDedupeRank(b) - leadDedupeRank(a);
  })[0];
}

export type ConsolidatePhoneDupesResult = {
  deletedIds: string[];
  /** Winner id → refreshed coupon_meta after history merge */
  winnerMetaById: Map<string, Record<string, unknown>>;
};

/**
 * TeleCRM phone merge: one open lead per phone.
 * Latest (or active job) stays; older duplicates → profile_history + soft-delete.
 */
export async function consolidateDuplicateLeadsByPhones(
  supabaseAdmin: any,
  phones: string[],
): Promise<ConsolidatePhoneDupesResult> {
  const deletedIds: string[] = [];
  const winnerMetaById = new Map<string, Record<string, unknown>>();
  const uniquePhones = Array.from(
    new Set(phones.map((p) => normalizeCustomerPhone(p)).filter(Boolean)),
  ).slice(0, 40);

  for (const phone10 of uniquePhones) {
    try {
      const { data: siblings, error } = await supabaseAdmin
        .from('service_leads')
        .select(
          'id, lead_number, status, customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, is_incomplete, coupon_meta, created_at, updated_at',
        )
        .or(phoneOrFilter(phone10))
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(40);

      if (error || !siblings?.length || siblings.length < 2) continue;

      const winner = pickCanonicalLeadForPhone(siblings);
      if (!winner?.id) continue;

      const losers = siblings.filter((r: any) => {
        if (String(r.id) === String(winner.id)) return false;
        // Never soft-delete another active workshop job
        if (ACTIVE_JOB_STATUSES.has(String(r.status || '').toUpperCase())) return false;
        return true;
      });
      if (!losers.length) continue;

      let meta =
        winner.coupon_meta && typeof winner.coupon_meta === 'object'
          ? ({ ...(winner.coupon_meta as Record<string, unknown>) } as Record<string, unknown>)
          : {};

      const nowIso = new Date().toISOString();
      for (const loser of losers) {
        const vehicle = [loser.vehicle_make, loser.vehicle_model, loser.vehicle_number]
          .map((v) => String(v || '').trim())
          .filter((v) => v && v.toUpperCase() !== 'NA')
          .join(' · ');
        const status = String(loser.status || '').toUpperCase() || 'LEAD';
        const statusLabel =
          status === 'NEW'
            ? 'Fresh'
            : status === 'VALIDATED'
              ? 'Booking confirmed'
              : status === 'IN_PROGRESS'
                ? 'In Service'
                : status === 'COMPLETED'
                  ? 'Service Done'
                  : status === 'REJECTED'
                    ? 'Lost'
                    : status.replace(/_/g, ' ');
        const leadNo = String(loser.lead_number || loser.id || '').slice(0, 24);
        meta = appendLeadProfileHistory(meta, {
          at: nowIso,
          summary: `Earlier lead ${leadNo} merged (same phone)${vehicle ? ` · ${vehicle}` : ''} · was ${statusLabel}`,
          status,
          event: 'PHONE_DUPLICATE_MERGED',
          previous_status: status,
          previous_label: leadNo || null,
        });
        deletedIds.push(String(loser.id));
      }

      const loserIds = losers.map((r: any) => String(r.id)).filter(Boolean);
      try {
        await mergeLeadTagsFromLosers(String(winner.id), loserIds);
      } catch (tagErr) {
        console.warn('[consolidateDuplicateLeadsByPhones] tag merge skipped:', tagErr);
      }
      const { error: delErr } = await supabaseAdmin
        .from('service_leads')
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .in('id', loserIds);
      if (delErr) {
        console.warn('[consolidateDuplicateLeadsByPhones] soft-delete failed:', delErr.message);
        continue;
      }

      const { error: winErr } = await supabaseAdmin
        .from('service_leads')
        .update({ coupon_meta: meta, updated_at: nowIso })
        .eq('id', winner.id);
      if (winErr) {
        console.warn('[consolidateDuplicateLeadsByPhones] winner history failed:', winErr.message);
      } else {
        winnerMetaById.set(String(winner.id), meta);
      }
    } catch (err) {
      console.warn('[consolidateDuplicateLeadsByPhones] skipped phone', phone10, err);
    }
  }

  return { deletedIds, winnerMetaById };
}
