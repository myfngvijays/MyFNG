import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';

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
    if (!payload.assigned_telecaller_id) {
      try {
        const picked = await pickTelecallerWeightedRoundRobin(
          bookingDistChannel(payload),
          payload.pincode ? String(payload.pincode) : null,
        );
        if (picked.telecallerId) {
          payload.assigned_telecaller_id = picked.telecallerId;
          payload.assigned_at = nowIso;
          payload.assignment_mode = 'AUTO';
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

  const bookingPincode =
    input.leadPayload.pincode != null
      ? String(input.leadPayload.pincode)
      : existing.pincode
        ? String(existing.pincode)
        : null;
  if (bookingPincode && !input.leadPayload.assigned_telecaller_id) {
    try {
      const picked = await pickTelecallerWeightedRoundRobin(
        bookingDistChannel(input.leadPayload),
        bookingPincode,
      );
      if (picked.telecallerId) {
        patch.assigned_telecaller_id = picked.telecallerId;
        patch.assigned_at = nowIso;
        patch.assignment_mode = 'AUTO';
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
        'id, lead_number, status, is_incomplete, coupon_meta, customer_name, customer_phone, created_at, updated_at',
      )
      .or(phoneOrFilter(phone10))
      .order('updated_at', { ascending: false })
      .limit(15);
    query = query.is('deleted_at', null);
    let { data, error } = await query;
    if (error && /deleted_at|is_incomplete/i.test(String(error.message || ''))) {
      ({ data, error } = await supabaseAdmin
        .from('service_leads')
        .select('id, lead_number, status, coupon_meta, customer_name, customer_phone, created_at, updated_at')
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

function otpChannelMeta(channel: BookingOtpChannel) {
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
  };
}

async function insertWebsiteOtpIncompleteLead(
  supabaseAdmin: any,
  phone10: string,
  nowIso: string,
  otpCouponMetaBase: Record<string, unknown>,
  channel: BookingOtpChannel = 'WEB',
): Promise<EnsureOtpVerifiedLeadResult> {
  const ch = otpChannelMeta(channel);
  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const couponMeta = appendLeadProfileHistory(otpCouponMetaBase, {
    at: nowIso,
    summary: ch.historySummary,
    status: 'OTP_VERIFIED',
    event: ch.historyEvent,
  });

  let assignedId: string | null = null;
  try {
    const distChannel = channel === 'MOBILE' ? 'APP_OTP' : 'WEBSITE_OTP';
    const picked = await pickTelecallerWeightedRoundRobin(distChannel);
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

  return {
    leadId: String(inserted.id),
    leadNumber: String(inserted.lead_number || leadNumber),
    created: true,
  };
}

/**
 * After booking OTP verify (web or mobile): create/refresh an incomplete lead so it
 * shows in admin bookings + telecaller CRM even if booking is abandoned.
 * Never overwrites an existing active booking — inserts a separate OTP stub instead.
 */
export async function ensureWebsiteOtpVerifiedLead(
  supabaseAdmin: any,
  phone: string | null | undefined,
  options?: { channel?: BookingOtpChannel },
): Promise<EnsureOtpVerifiedLeadResult> {
  const phone10 = normalizeCustomerPhone(phone);
  if (!phone10) {
    return { leadId: null, leadNumber: null, created: false, skipped: 'invalid_phone' };
  }

  const channel: BookingOtpChannel = options?.channel === 'MOBILE' ? 'MOBILE' : 'WEB';
  const ch = otpChannelMeta(channel);
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
      const distChannel = channel === 'MOBILE' ? 'APP_OTP' : 'WEBSITE_OTP';
      const picked = await pickTelecallerWeightedRoundRobin(distChannel);
      assignedId = picked.telecallerId || null;
    } catch (err) {
      console.warn('[ensureWebsiteOtpVerifiedLead] assign failed:', err);
    }

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
  if (status === 'NEW' || status === 'CONTACTED' || status === 'ASSIGNED') return 80;
  if (status === 'VALIDATED' || status === 'ACCEPTED' || status === 'IN_PROGRESS') return 70;
  if (status === 'REJECTED' || status === 'COMPLETED' || status === 'CANCELLED') return 10;
  return 40;
}

/** Collapse CRM list to one row per phone (prefer chaseable OTP/NEW over Lost). */
export function dedupeLeadsByPhone<T extends { customer_phone?: string | null; updated_at?: string | null; created_at?: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const sorted = [...rows].sort((a, b) => {
    const rankDiff = leadDedupeRank(b) - leadDedupeRank(a);
    if (rankDiff !== 0) return rankDiff;
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });
  for (const row of sorted) {
    const key = normalizeCustomerPhone(row.customer_phone) || `id:${(row as any).id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
