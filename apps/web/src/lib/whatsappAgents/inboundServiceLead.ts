import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pickTelecallerForLead } from '@/lib/enquiry/assignment';
import { channelFromWhatsAppLabels } from '@/lib/enquiry/leadChannels';
import { findCustomerByPhone } from '@/lib/customer-service-leads';
import { leadSourceLabelForWacaBusinessPhone } from '@/lib/telecrm/parseTelecrmWebhookPayload';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';
import { stampFreshCrmDisposition } from '@/lib/telecaller/freshLeadStatus';
import {
  addLeadTags,
  ensureTagIdsByNames,
  resolveMetaAdTagNames,
  stampFreshOnMeta,
} from '@/lib/telecaller/crmLeadTagsApply';

export type WhatsAppReferral = {
  source_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  headline?: string | null;
  body?: string | null;
  media_type?: string | null;
  image_url?: string | null;
  ctwa_clid?: string | null;
  welcome_message?: { text?: string } | null;
};

export type EnsureWhatsAppLeadInput = {
  phone: string;
  profileName?: string | null;
  messageText?: string | null;
  referral?: WhatsAppReferral | null;
  providerMessageId?: string | null;
  inboundReceivedAt?: string | null;
  /** Business line that received the message (e.g. 9594996161 / 9167779696). */
  businessPhone?: string | null;
};

export type KnownCustomerFill = {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_variant?: string | null;
  city?: string | null;
  pincode?: string | null;
  customer_address?: string | null;
  pickup_address?: string | null;
};

/** Open / in-progress statuses that should receive new WhatsApp messages (enum-safe). */
const OPEN_STATUSES = [
  'NEW',
  'VALIDATED',
  'HOLD',
  'ACCEPTED',
  'IN_PROGRESS',
  'ASSIGNED_TO_WORKSHOP',
  'ON_THE_WAY',
  'VEHICLE_DROPPED_AT_WORKSHOP',
  'READY_FOR_BILLING',
  'READY_FOR_DELIVERY',
  'QC_APPROVED',
  'REWORK_REQUIRED',
];

const CLOSED_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'DELIVERED', 'REJECTED']);

function normalizePhone10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function isPlaceholderName(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^whatsapp\s*\d+/i.test(n)) return true;
  if (/^user\s*\d+$/i.test(n)) return true;
  if (/^customer\s*\d+$/i.test(n)) return true;
  return false;
}

function isPlaceholderVehicle(v: string | null | undefined): boolean {
  const n = String(v || '').trim().toUpperCase();
  return !n || n === 'NA' || n === 'N/A' || n === '-';
}

/** Extract Meta Click-to-WhatsApp / ad referral from inbound message payload. */
export function extractWhatsAppReferral(inbound: any): WhatsAppReferral | null {
  const ref = inbound?.referral;
  if (!ref || typeof ref !== 'object') return null;

  const sourceType = String(ref.source_type || '').trim();
  const sourceUrl = String(ref.source_url || '').trim();
  const sourceId = String(ref.source_id || '').trim();
  const ctwaClid = String(ref.ctwa_clid || '').trim();

  if (!sourceType && !sourceUrl && !sourceId && !ctwaClid) return null;

  return {
    source_url: sourceUrl || null,
    source_type: sourceType || null,
    source_id: sourceId || null,
    headline: ref.headline ? String(ref.headline) : null,
    body: ref.body ? String(ref.body) : null,
    media_type: ref.media_type ? String(ref.media_type) : null,
    image_url: ref.image_url ? String(ref.image_url) : null,
    ctwa_clid: ctwaClid || null,
    welcome_message: ref.welcome_message || null,
  };
}

function resolveLeadLabels(
  referral: WhatsAppReferral | null | undefined,
  businessPhone?: string | null,
) {
  if (!referral) {
    const business10 = normalizePhone10(businessPhone || '');
    return {
      created_from: 'WHATSAPP',
      lead_source: business10
        ? leadSourceLabelForWacaBusinessPhone(business10)
        : 'WhatsApp',
    };
  }

  const url = String(referral.source_url || '').toLowerCase();
  const type = String(referral.source_type || '').toLowerCase();
  const isInstagram = url.includes('instagram') || type.includes('instagram');
  const isFacebook = url.includes('facebook') || url.includes('fb.') || type.includes('facebook');

  if (isInstagram) {
    return { created_from: 'WHATSAPP_META', lead_source: 'Instagram Ads' };
  }
  if (isFacebook || type === 'ad' || referral.ctwa_clid) {
    return { created_from: 'WHATSAPP_META', lead_source: 'Facebook Ads' };
  }
  return { created_from: 'WHATSAPP_META', lead_source: 'Meta Ads' };
}

function buildCouponMeta(input: {
  existing?: Record<string, unknown> | null;
  referral: WhatsAppReferral | null | undefined;
  messageText?: string | null;
  profileName?: string | null;
  providerMessageId?: string | null;
  businessPhone?: string | null;
  nowIso: string;
  isFirst?: boolean;
  known?: KnownCustomerFill | null;
}) {
  const prev =
    input.existing && typeof input.existing === 'object' ? { ...input.existing } : {};
  const msg = String(input.messageText || '').trim().slice(0, 500) || null;
  const businessPhone = normalizePhone10(input.businessPhone || '') || null;
  return {
    ...prev,
    whatsapp_inbound: true,
    whatsapp_enquiry: true,
    meta_referral: input.referral || prev.meta_referral || null,
    last_inbound_at: input.nowIso,
    last_inbound_message: msg,
    profile_name: input.profileName || prev.profile_name || null,
    provider_message_id: input.providerMessageId || prev.provider_message_id || null,
    autofill_from_customer: Boolean(input.known?.customer_id || input.known?.vehicle_number),
    ...(businessPhone
      ? { wa_business_phone: businessPhone, wa_inbox: businessPhone }
      : {}),
    ...(input.isFirst
      ? { first_message: msg, inbound_at: input.nowIso }
      : {}),
  };
}

/** Pull name / car / address from customers, vehicles, and past leads. */
export async function lookupKnownCustomerFill(
  supabaseAdmin: any,
  phone10: string,
): Promise<KnownCustomerFill> {
  const fill: KnownCustomerFill = {};

  try {
    const customer = await findCustomerByPhone(supabaseAdmin, phone10);
    if (customer?.id) {
      fill.customer_id = String(customer.id);
      if (customer.full_name && !isPlaceholderName(customer.full_name)) {
        fill.customer_name = String(customer.full_name).trim();
      }
      if (customer.email) fill.customer_email = String(customer.email).trim();

      const { data: vehicles } = await supabaseAdmin
        .from('customer_vehicles')
        .select('vehicle_number, make, model, variant, is_default, updated_at')
        .eq('customer_id', customer.id)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(5);

      const vehicle =
        (vehicles || []).find((v: any) => v?.is_default && !isPlaceholderVehicle(v.vehicle_number)) ||
        (vehicles || []).find((v: any) => !isPlaceholderVehicle(v?.vehicle_number)) ||
        null;

      if (vehicle) {
        fill.vehicle_number = String(vehicle.vehicle_number || '').trim().toUpperCase() || null;
        fill.vehicle_make = vehicle.make ? String(vehicle.make).trim() : null;
        fill.vehicle_model = vehicle.model ? String(vehicle.model).trim() : null;
        fill.vehicle_variant = vehicle.variant ? String(vehicle.variant).trim() : null;
      }
    }
  } catch (e) {
    console.warn('[whatsapp-inbound-lead] customer lookup failed', e);
  }

  try {
    const { data: pastLeads } = await supabaseAdmin
      .from('service_leads')
      .select(
        `customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, vehicle_variant,
         city, pincode, customer_address, pickup_address, created_at`,
      )
      .or(
        `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
      )
      .order('created_at', { ascending: false })
      .limit(15);

    for (const row of pastLeads || []) {
      if (!fill.customer_name && !isPlaceholderName(row.customer_name)) {
        fill.customer_name = String(row.customer_name).trim();
      }
      if (isPlaceholderVehicle(fill.vehicle_number) && !isPlaceholderVehicle(row.vehicle_number)) {
        fill.vehicle_number = String(row.vehicle_number).trim().toUpperCase();
        fill.vehicle_make = fill.vehicle_make || (row.vehicle_make ? String(row.vehicle_make).trim() : null);
        fill.vehicle_model =
          fill.vehicle_model || (row.vehicle_model ? String(row.vehicle_model).trim() : null);
        fill.vehicle_variant =
          fill.vehicle_variant || (row.vehicle_variant ? String(row.vehicle_variant).trim() : null);
      }
      if (!fill.city && row.city) fill.city = String(row.city).trim();
      if (!fill.pincode && row.pincode) fill.pincode = String(row.pincode).trim();
      if (!fill.customer_address && row.customer_address) {
        fill.customer_address = String(row.customer_address).trim();
      }
      if (!fill.pickup_address && (row.pickup_address || row.customer_address)) {
        fill.pickup_address = String(row.pickup_address || row.customer_address).trim();
      }
    }
  } catch (e) {
    console.warn('[whatsapp-inbound-lead] past lead lookup failed', e);
  }

  return fill;
}

function applyKnownFillToPatch(
  patch: Record<string, unknown>,
  existing: Record<string, any> | null,
  known: KnownCustomerFill,
) {
  if (known.customer_name && isPlaceholderName(existing?.customer_name)) {
    patch.customer_name = known.customer_name;
  }
  if (known.customer_email && !existing?.customer_email) {
    patch.customer_email = known.customer_email;
  }
  if (known.vehicle_number && isPlaceholderVehicle(existing?.vehicle_number)) {
    patch.vehicle_number = known.vehicle_number;
  }
  if (known.vehicle_make && !existing?.vehicle_make) patch.vehicle_make = known.vehicle_make;
  if (known.vehicle_model && !existing?.vehicle_model) patch.vehicle_model = known.vehicle_model;
  if (known.vehicle_variant && !existing?.vehicle_variant) {
    patch.vehicle_variant = known.vehicle_variant;
  }
  if (known.city && !existing?.city) patch.city = known.city;
  if (known.pincode && !existing?.pincode) patch.pincode = known.pincode;
  if (known.customer_address && !existing?.customer_address) {
    patch.customer_address = known.customer_address;
  }
  if (known.pickup_address && !existing?.pickup_address) {
    patch.pickup_address = known.pickup_address;
  }
}

/**
 * Create (or reuse) a telecaller-visible service_lead for WhatsApp inbound.
 * Dedupes open leads for the same phone so repeat chats don't spam the queue.
 * Auto-assigns via Telecaller Distribution so RLS + CRM queue both show the lead.
 * Auto-fills name/vehicle/address from customers + past leads when available.
 */
export async function ensureWhatsAppInboundServiceLead(
  input: EnsureWhatsAppLeadInput,
): Promise<{ created: boolean; leadId: string | null; skipped?: string; assignedTo?: string | null }> {
  const phone10 = normalizePhone10(input.phone);
  if (phone10.length < 10) {
    return { created: false, leadId: null, skipped: 'invalid_phone' };
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.warn('[whatsapp-inbound-lead] admin unavailable:', adminError);
    return { created: false, leadId: null, skipped: 'no_admin' };
  }

  let labels = resolveLeadLabels(input.referral, input.businessPhone);
  const nowIso = input.inboundReceivedAt || new Date().toISOString();
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const known = await lookupKnownCustomerFill(supabaseAdmin, phone10);
  const firstMsgForRoute = String(input.messageText || '').trim();

  // Reuse open lead for same phone (10-digit or with 91 prefix)
  let existingRows: any[] | null = null;
  let findErr: any = null;
  {
    const res = await supabaseAdmin
      .from('service_leads')
      .select(
        `id, lead_number, status, coupon_meta, created_from, lead_source, customer_phone, assigned_telecaller_id,
         customer_name, customer_email, vehicle_number, vehicle_make, vehicle_model, vehicle_variant,
         city, pincode, customer_address, pickup_address`,
      )
      .or(
        `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
      )
      .in('status', OPEN_STATUSES)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(5);
    existingRows = res.data;
    findErr = res.error;
  }

  // Fallback without status enum filter (older / mismatched enums)
  if (findErr) {
    console.warn('[whatsapp-inbound-lead] find retry without status filter:', findErr.message);
    const res = await supabaseAdmin
      .from('service_leads')
      .select(
        `id, lead_number, status, coupon_meta, created_from, lead_source, customer_phone, assigned_telecaller_id,
         customer_name, customer_email, vehicle_number, vehicle_make, vehicle_model, vehicle_variant,
         city, pincode, customer_address, pickup_address`,
      )
      .or(
        `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
      )
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(10);
    existingRows = (res.data || []).filter((r: any) => !CLOSED_STATUSES.has(String(r.status || '').toUpperCase()));
    findErr = res.error;
  }

  if (findErr) {
    console.warn('[whatsapp-inbound-lead] find failed:', findErr.message);
  }

  const existing = (existingRows || [])[0] || null;
  if (existing?.id) {
    const prevMeta =
      existing.coupon_meta && typeof existing.coupon_meta === 'object'
        ? (existing.coupon_meta as Record<string, unknown>)
        : {};

    const patch: Record<string, unknown> = {
      coupon_meta: stampFreshOnMeta(
        buildCouponMeta({
          existing: prevMeta,
          referral: input.referral,
          messageText: input.messageText,
          profileName: input.profileName,
          providerMessageId: input.providerMessageId,
          businessPhone: input.businessPhone,
          nowIso,
          known,
        }) as Record<string, unknown>,
      ),
      problem_description: String(input.messageText || '').trim().slice(0, 1000) || undefined,
      updated_at: new Date().toISOString(),
    };

    applyKnownFillToPatch(patch, existing, known);

    if (input.referral) {
      patch.lead_source = labels.lead_source;
      patch.created_from = labels.created_from;
    }

    let assignedTo: string | null = existing.assigned_telecaller_id
      ? String(existing.assigned_telecaller_id)
      : null;
    let assignmentChanged = false;
    let previousAssigneeForNotify: string | null = assignedTo;
    // Always evaluate message triggers on inbound text.
    // Trigger match → force assignee (even if lead already belongs to someone else).
    // No trigger → only assign if currently unassigned (weighted RR).
    try {
      const channel = channelFromWhatsAppLabels(labels.created_from, labels.lead_source);
      const picked = await pickTelecallerForLead({
        channel,
        messageText: firstMsgForRoute,
        pincode: known.pincode || existing?.pincode || null,
      });
      const isTriggerRoute =
        picked.assignment_mode === 'MESSAGE_TRIGGER' && Boolean(picked.telecallerId);
      // Trigger → always set/change assignee. No trigger → only fill if unassigned.
      const shouldAssign = Boolean(picked.telecallerId) && (isTriggerRoute || !assignedTo);

      if (isTriggerRoute && picked.trigger?.mark_as_meta) {
        labels = {
          created_from: 'WHATSAPP_META',
          lead_source: picked.trigger.label
            ? `Meta Ads · ${picked.trigger.label}`
            : 'Meta Ads',
        };
        patch.lead_source = labels.lead_source;
        patch.created_from = labels.created_from;
      }

      if (shouldAssign && picked.telecallerId) {
        const prevAssignee = assignedTo;
        previousAssigneeForNotify = prevAssignee;
        const changing = Boolean(prevAssignee && prevAssignee !== picked.telecallerId);
        assignmentChanged = !prevAssignee || changing;
        patch.assigned_telecaller_id = picked.telecallerId;
        patch.assigned_at = nowIso;
        assignedTo = picked.telecallerId;
        const baseMeta =
          typeof patch.coupon_meta === 'object' && patch.coupon_meta
            ? (patch.coupon_meta as Record<string, unknown>)
            : existing.coupon_meta && typeof existing.coupon_meta === 'object'
              ? (existing.coupon_meta as Record<string, unknown>)
              : {};
        patch.coupon_meta = {
          ...baseMeta,
          message_trigger_id: picked.trigger?.id || null,
          message_trigger_label: picked.trigger?.label || null,
          assignment_mode: picked.assignment_mode || null,
          ...(changing
            ? {
                previous_assigned_telecaller_id: prevAssignee,
                reassigned_by_trigger: true,
                reassigned_at: nowIso,
              }
            : {}),
        };
        console.log('[whatsapp-inbound-lead] assign/reassign', {
          leadId: existing.id,
          from: prevAssignee,
          to: picked.telecallerId,
          mode: picked.assignment_mode,
          trigger: picked.trigger?.phrase || null,
        });
      }
    } catch (e) {
      console.warn('[whatsapp-inbound-lead] assign on enrich failed', e);
    }

    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    try {
      await supabaseAdmin.from('service_leads').update(patch).eq('id', existing.id);
    } catch (e) {
      console.warn('[whatsapp-inbound-lead] enrich failed', e);
    }

    // TeleCRM-style: common Meta Ads + specific ad tag (A/B/C…)
    try {
      const metaTags = resolveMetaAdTagNames({
        leadSource: String(patch.lead_source || labels.lead_source || existing.lead_source || ''),
        triggerLabel: String(
          (typeof patch.coupon_meta === 'object' &&
            patch.coupon_meta &&
            (patch.coupon_meta as any).message_trigger_label) ||
            '',
        ),
        referralHeadline: input.referral?.headline || null,
        markAsMeta: /WHATSAPP_META/i.test(String(patch.created_from || labels.created_from || '')),
      });
      if (metaTags.names.length) {
        const tagIds = await ensureTagIdsByNames(metaTags.names, {
          parentName: metaTags.parent,
        });
        await addLeadTags(String(existing.id), tagIds);
      }
    } catch (e) {
      console.warn('[whatsapp-inbound-lead] tag apply failed', e);
    }

    if (assignmentChanged && assignedTo) {
      void notifyTelecallerNewLeadAssignedSafe({
        leadId: String(existing.id),
        leadNumber: existing.lead_number ? String(existing.lead_number) : null,
        telecallerId: assignedTo,
        previousTelecallerId: previousAssigneeForNotify,
        assignedByName: 'WhatsApp inbound',
        notes: 'New WhatsApp lead',
      });
    }

    return {
      created: false,
      leadId: String(existing.id),
      skipped: 'existing_open_lead',
      assignedTo,
    };
  }

  let assignedTelecallerId: string | null = null;
  let assignmentMode: string | null = null;
  let triggerId: string | null = null;
  let triggerLabel: string | null = null;
  try {
    const channel = channelFromWhatsAppLabels(labels.created_from, labels.lead_source);
    const picked = await pickTelecallerForLead({
      channel,
      messageText: firstMsgForRoute,
      pincode: known.pincode || null,
    });
    assignedTelecallerId = picked.telecallerId || null;
    assignmentMode = picked.assignment_mode || null;
    if (picked.trigger) {
      triggerId = picked.trigger.id;
      triggerLabel = picked.trigger.label || picked.trigger.phrase;
      if (picked.trigger.mark_as_meta) {
        labels = {
          created_from: 'WHATSAPP_META',
          lead_source: triggerLabel ? `Meta Ads · ${triggerLabel}` : 'Meta Ads',
        };
      }
    }
  } catch (e) {
    console.warn('[whatsapp-inbound-lead] assignment failed', e);
  }

  const name =
    known.customer_name ||
    String(input.profileName || '').trim() ||
    `WhatsApp ${phone10.slice(-4)}`;
  const firstMsg = firstMsgForRoute.slice(0, 500);
  const headline = String(input.referral?.headline || '').trim();
  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

  const descriptionParts = [
    labels.created_from === 'WHATSAPP_META' || input.referral
      ? `Meta ${labels.lead_source}`
      : 'WhatsApp inbound',
    headline ? `Ad: ${headline}` : null,
    triggerLabel ? `Trigger: ${triggerLabel}` : null,
    firstMsg ? `Msg: ${firstMsg}` : null,
  ].filter(Boolean);

  const couponMeta = stampFreshCrmDisposition(
    buildCouponMeta({
      referral: input.referral,
      messageText: firstMsg,
      profileName: input.profileName,
      providerMessageId: input.providerMessageId,
      businessPhone: input.businessPhone,
      nowIso,
      isFirst: true,
      known,
    }) as Record<string, unknown>,
  );
  if (triggerId) {
    couponMeta.message_trigger_id = triggerId;
    couponMeta.message_trigger_label = triggerLabel;
    couponMeta.assignment_mode = assignmentMode;
  }

  const basePayload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: labels.lead_source,
    created_from: labels.created_from,
    status: 'NEW',
    customer_name: name,
    customer_phone: phone10,
    customer_email: known.customer_email || null,
    vehicle_number: known.vehicle_number || 'NA',
    vehicle_make: known.vehicle_make || null,
    vehicle_model: known.vehicle_model || null,
    vehicle_variant: known.vehicle_variant || null,
    city: known.city || null,
    pincode: known.pincode || null,
    customer_address: known.customer_address || null,
    pickup_address: known.pickup_address || null,
    service_type: 'WhatsApp Enquiry',
    description: descriptionParts.join(' · '),
    problem_description: firstMsg || headline || null,
    is_incomplete: true,
    lead_priority: input.referral || triggerId ? 'HIGH' : 'NORMAL',
    assigned_telecaller_id: assignedTelecallerId,
    assigned_at: assignedTelecallerId ? nowIso : null,
    coupon_meta: couponMeta,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const tryInsert = async (payload: Record<string, unknown>) => {
    return supabaseAdmin.from('service_leads').insert([payload]).select('id').maybeSingle();
  };

  let { data: inserted, error: insertErr } = await tryInsert(basePayload);

  if (insertErr) {
    console.warn('[whatsapp-inbound-lead] insert retry slim:', insertErr.message);
    const slim = { ...basePayload };
    delete slim.is_incomplete;
    delete slim.lead_priority;
    delete slim.problem_description;
    delete slim.assigned_at;
    delete slim.description;
    delete slim.customer_email;
    delete slim.vehicle_variant;
    delete slim.pickup_address;
    ({ data: inserted, error: insertErr } = await tryInsert(slim));
  }

  if (insertErr && /created_from|check constraint/i.test(insertErr.message || '')) {
    console.warn('[whatsapp-inbound-lead] created_from fallback:', insertErr.message);
    const fallback = {
      ...basePayload,
      created_from: 'API',
    };
    delete fallback.is_incomplete;
    delete fallback.lead_priority;
    delete fallback.assigned_at;
    ({ data: inserted, error: insertErr } = await tryInsert(fallback));
  }

  if (insertErr) {
    console.error('[whatsapp-inbound-lead] insert failed:', insertErr.message);
    return { created: false, leadId: null, skipped: insertErr.message };
  }

  console.log(
    '[whatsapp-inbound-lead] created',
    inserted?.id,
    labels,
    phone10,
    'assigned',
    assignedTelecallerId,
    'autofill',
    Boolean(known.customer_name || known.vehicle_number),
  );

  if (inserted?.id && assignedTelecallerId) {
    void notifyTelecallerNewLeadAssignedSafe({
      leadId: String(inserted.id),
      leadNumber: leadNumber,
      telecallerId: assignedTelecallerId,
      assignedByName: 'WhatsApp inbound',
      notes: 'New WhatsApp lead',
    });
  }

  if (inserted?.id) {
    try {
      const metaTags = resolveMetaAdTagNames({
        leadSource: labels.lead_source,
        triggerLabel,
        referralHeadline: input.referral?.headline || null,
        markAsMeta: /WHATSAPP_META/i.test(labels.created_from),
      });
      if (metaTags.names.length) {
        const tagIds = await ensureTagIdsByNames(metaTags.names, {
          parentName: metaTags.parent,
        });
        await addLeadTags(String(inserted.id), tagIds);
      }
    } catch (e) {
      console.warn('[whatsapp-inbound-lead] tag apply on create failed', e);
    }
  }

  return {
    created: true,
    leadId: inserted?.id ? String(inserted.id) : null,
    assignedTo: assignedTelecallerId,
  };
}

/**
 * Backfill / refresh service_leads from recent inbound WhatsApp messages.
 * Safe to call on CRM queue load so leads appear even if production webhook lag.
 */
export async function syncRecentWhatsAppInboundLeads(opts?: {
  hours?: number;
  limit?: number;
  phone?: string | null;
}): Promise<{
  scanned: number;
  unique: number;
  created: number;
  enriched: number;
  failed: number;
}> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.warn('[whatsapp-inbound-sync] admin unavailable:', adminError);
    return { scanned: 0, unique: 0, created: 0, enriched: 0, failed: 0 };
  }

  const hours = Math.min(Math.max(Number(opts?.hours) || 12, 1), 24 * 30);
  const limit = Math.min(Math.max(Number(opts?.limit) || 120, 1), 500);
  const phoneFilter = String(opts?.phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from('whatsapp_messages')
    .select('id, sender_phone, recipient_phone, text_body, created_at, status_at, meta, payload')
    .eq('direction', 'INBOUND')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (phoneFilter.length === 10) {
    query = query.or(
      `sender_phone.eq.${phoneFilter},sender_phone.eq.91${phoneFilter},sender_phone.ilike.%${phoneFilter}`,
    );
  }

  const { data: rows, error } = await query;
  if (error) {
    console.warn('[whatsapp-inbound-sync] query failed:', error.message);
    return { scanned: 0, unique: 0, created: 0, enriched: 0, failed: 0 };
  }

  const byPhone = new Map<
    string,
    {
      phone: string;
      text: string | null;
      at: string;
      profileName: string | null;
      providerMessageId: string | null;
      referral: any;
      businessPhone: string | null;
    }
  >();

  for (const row of rows || []) {
    const phone10 = normalizePhone10(String(row.sender_phone || ''));
    if (phone10.length < 10) continue;
    if (byPhone.has(phone10)) continue;
    const meta = row.meta && typeof row.meta === 'object' ? (row.meta as any) : {};
    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as any) : {};
    byPhone.set(phone10, {
      phone: phone10,
      text: row.text_body || null,
      at: row.status_at || row.created_at || new Date().toISOString(),
      profileName: meta?.profile_name || null,
      providerMessageId: String(payload?.id || row.id || '').trim() || null,
      referral: payload?.referral || null,
      businessPhone: normalizePhone10(String(row.recipient_phone || '')) || null,
    });
  }

  let created = 0;
  let enriched = 0;
  let failed = 0;

  for (const item of byPhone.values()) {
    const result = await ensureWhatsAppInboundServiceLead({
      phone: item.phone,
      profileName: item.profileName,
      messageText: item.text,
      referral: item.referral,
      businessPhone: item.businessPhone,
      providerMessageId: item.providerMessageId,
      inboundReceivedAt: item.at,
    });
    if (result.created) created += 1;
    else if (result.leadId) enriched += 1;
    else failed += 1;
  }

  return {
    scanned: (rows || []).length,
    unique: byPhone.size,
    created,
    enriched,
    failed,
  };
}
