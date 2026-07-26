import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';

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
};

const OPEN_STATUSES = ['NEW', 'CONTACTED', 'INCOMPLETE', 'ASSIGNED', 'VALIDATED', 'PENDING'];

function normalizePhone10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
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

function resolveLeadLabels(referral: WhatsAppReferral | null | undefined) {
  if (!referral) {
    return {
      created_from: 'WHATSAPP',
      lead_source: 'WhatsApp',
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
  nowIso: string;
  isFirst?: boolean;
}) {
  const prev =
    input.existing && typeof input.existing === 'object' ? { ...input.existing } : {};
  const msg = String(input.messageText || '').trim().slice(0, 500) || null;
  return {
    ...prev,
    whatsapp_inbound: true,
    whatsapp_enquiry: true,
    meta_referral: input.referral || prev.meta_referral || null,
    last_inbound_at: input.nowIso,
    last_inbound_message: msg,
    profile_name: input.profileName || prev.profile_name || null,
    provider_message_id: input.providerMessageId || prev.provider_message_id || null,
    ...(input.isFirst
      ? { first_message: msg, inbound_at: input.nowIso }
      : {}),
  };
}

/**
 * Create (or reuse) a telecaller-visible service_lead for WhatsApp inbound.
 * Dedupes open leads for the same phone so repeat chats don't spam the queue.
 * Auto-assigns via Telecaller Distribution so RLS + CRM queue both show the lead.
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

  const labels = resolveLeadLabels(input.referral);
  const nowIso = input.inboundReceivedAt || new Date().toISOString();
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Reuse open lead for same phone (10-digit or with 91 prefix)
  const { data: existingRows, error: findErr } = await supabaseAdmin
    .from('service_leads')
    .select('id, status, coupon_meta, created_from, lead_source, customer_phone, assigned_telecaller_id')
    .or(`customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`)
    .in('status', OPEN_STATUSES)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(5);

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
      coupon_meta: buildCouponMeta({
        existing: prevMeta,
        referral: input.referral,
        messageText: input.messageText,
        profileName: input.profileName,
        providerMessageId: input.providerMessageId,
        nowIso,
      }),
      problem_description: String(input.messageText || '').trim().slice(0, 1000) || undefined,
      updated_at: new Date().toISOString(),
    };

    if (input.referral) {
      patch.lead_source = labels.lead_source;
      patch.created_from = labels.created_from;
    }

    // Auto-assign if still unassigned so telecaller CRM/RLS can see it
    let assignedTo: string | null = existing.assigned_telecaller_id
      ? String(existing.assigned_telecaller_id)
      : null;
    if (!assignedTo) {
      try {
        const { telecallerId } = await pickTelecallerWeightedRoundRobin();
        if (telecallerId) {
          patch.assigned_telecaller_id = telecallerId;
          patch.assigned_at = nowIso;
          assignedTo = telecallerId;
        }
      } catch (e) {
        console.warn('[whatsapp-inbound-lead] assign on enrich failed', e);
      }
    }

    // Drop undefined keys (problem_description when empty)
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    try {
      await supabaseAdmin.from('service_leads').update(patch).eq('id', existing.id);
    } catch (e) {
      console.warn('[whatsapp-inbound-lead] enrich failed', e);
    }

    return {
      created: false,
      leadId: String(existing.id),
      skipped: 'existing_open_lead',
      assignedTo,
    };
  }

  // New lead — pick telecaller for distribution
  let assignedTelecallerId: string | null = null;
  try {
    const picked = await pickTelecallerWeightedRoundRobin();
    assignedTelecallerId = picked.telecallerId || null;
  } catch (e) {
    console.warn('[whatsapp-inbound-lead] assignment failed', e);
  }

  const name =
    String(input.profileName || '').trim() ||
    `WhatsApp ${phone10.slice(-4)}`;
  const firstMsg = String(input.messageText || '').trim().slice(0, 500);
  const headline = String(input.referral?.headline || '').trim();
  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

  const descriptionParts = [
    input.referral ? `Meta ${labels.lead_source}` : 'WhatsApp inbound',
    headline ? `Ad: ${headline}` : null,
    firstMsg ? `Msg: ${firstMsg}` : null,
  ].filter(Boolean);

  const basePayload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: labels.lead_source,
    created_from: labels.created_from,
    status: 'NEW',
    customer_name: name,
    customer_phone: phone10,
    vehicle_number: 'NA',
    service_type: 'WhatsApp Enquiry',
    description: descriptionParts.join(' · '),
    problem_description: firstMsg || headline || null,
    is_incomplete: true,
    lead_priority: input.referral ? 'HIGH' : 'NORMAL',
    assigned_telecaller_id: assignedTelecallerId,
    assigned_at: assignedTelecallerId ? nowIso : null,
    coupon_meta: buildCouponMeta({
      referral: input.referral,
      messageText: firstMsg,
      profileName: input.profileName,
      providerMessageId: input.providerMessageId,
      nowIso,
      isFirst: true,
    }),
    created_at: nowIso,
    updated_at: nowIso,
  };

  const tryInsert = async (payload: Record<string, unknown>) => {
    return supabaseAdmin.from('service_leads').insert([payload]).select('id').maybeSingle();
  };

  let { data: inserted, error: insertErr } = await tryInsert(basePayload);

  // Retry without optional columns that older DBs may lack
  if (insertErr) {
    console.warn('[whatsapp-inbound-lead] insert retry slim:', insertErr.message);
    const slim = { ...basePayload };
    delete slim.is_incomplete;
    delete slim.lead_priority;
    delete slim.problem_description;
    delete slim.assigned_at;
    delete slim.description;
    ({ data: inserted, error: insertErr } = await tryInsert(slim));
  }

  // Older DBs may restrict created_from CHECK — fall back to API while keeping WhatsApp lead_source
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
  );
  return {
    created: true,
    leadId: inserted?.id ? String(inserted.id) : null,
    assignedTo: assignedTelecallerId,
  };
}
