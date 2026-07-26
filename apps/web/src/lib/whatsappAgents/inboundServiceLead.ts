import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

const OPEN_STATUSES = ['NEW', 'CONTACTED', 'INCOMPLETE', 'ASSIGNED', 'VALIDATED'];

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

/**
 * Create (or reuse) a telecaller-visible service_lead for WhatsApp inbound.
 * Dedupes open leads for the same phone so repeat chats don't spam the queue.
 */
export async function ensureWhatsAppInboundServiceLead(
  input: EnsureWhatsAppLeadInput,
): Promise<{ created: boolean; leadId: string | null; skipped?: string }> {
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
    .select('id, status, coupon_meta, created_from, lead_source, customer_phone')
    .in('customer_phone', [phone10, `91${phone10}`])
    .in('status', OPEN_STATUSES)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(5);

  if (findErr) {
    console.warn('[whatsapp-inbound-lead] find failed:', findErr.message);
  }

  const existing = (existingRows || [])[0] || null;
  if (existing?.id) {
    // Enrich attribution if this inbound has Meta referral
    if (input.referral) {
      try {
        const prevMeta =
          existing.coupon_meta && typeof existing.coupon_meta === 'object'
            ? (existing.coupon_meta as Record<string, unknown>)
            : {};
        await supabaseAdmin
          .from('service_leads')
          .update({
            lead_source: labels.lead_source,
            created_from: labels.created_from,
            coupon_meta: {
              ...prevMeta,
              whatsapp_inbound: true,
              meta_referral: input.referral,
              last_inbound_at: nowIso,
              last_inbound_message: String(input.messageText || '').slice(0, 500) || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } catch (e) {
        console.warn('[whatsapp-inbound-lead] enrich failed', e);
      }
    }
    return { created: false, leadId: String(existing.id), skipped: 'existing_open_lead' };
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

  const payload: Record<string, unknown> = {
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
    assigned_telecaller_id: null,
    coupon_meta: {
      whatsapp_inbound: true,
      whatsapp_enquiry: true,
      meta_referral: input.referral || null,
      first_message: firstMsg || null,
      profile_name: input.profileName || null,
      provider_message_id: input.providerMessageId || null,
      inbound_at: nowIso,
    },
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('service_leads')
    .insert([payload])
    .select('id')
    .maybeSingle();

  if (insertErr) {
    // Retry without optional columns that older DBs may lack
    const slim = { ...payload };
    delete slim.is_incomplete;
    delete slim.lead_priority;
    delete slim.problem_description;
    delete slim.assigned_telecaller_id;
    const { data: retry, error: retryErr } = await supabaseAdmin
      .from('service_leads')
      .insert([slim])
      .select('id')
      .maybeSingle();
    if (retryErr) {
      console.error('[whatsapp-inbound-lead] insert failed:', insertErr.message, retryErr.message);
      return { created: false, leadId: null, skipped: retryErr.message };
    }
    console.log('[whatsapp-inbound-lead] created (slim)', retry?.id, labels, phone10);
    return { created: true, leadId: retry?.id ? String(retry.id) : null };
  }

  console.log('[whatsapp-inbound-lead] created', inserted?.id, labels, phone10);
  return { created: true, leadId: inserted?.id ? String(inserted.id) : null };
}
