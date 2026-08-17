import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pickTelecallerForLead } from '@/lib/enquiry/assignment';
import {
  leadSourceLabelForWacaBusinessPhone,
  sanitizeTelecrmInboundMessage,
  TELECRM_WACA_BUSINESS_PHONE,
  type ParsedTelecrmWebhookPayload,
} from './parseTelecrmWebhookPayload';
import { resolveTelecallerUserId } from './resolveTelecallerUserId';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';

const OPEN_STATUSES = ['NEW', 'VALIDATED', 'HOLD', 'ACCEPTED', 'IN_PROGRESS', 'ASSIGNED'];

function normalizePhone10(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length > 10) digits = digits.slice(-10);
  return digits.slice(-10);
}

function wacaLeadSourceLabel(businessPhone: string): string {
  const phone10 = normalizePhone10(businessPhone || TELECRM_WACA_BUSINESS_PHONE);
  return leadSourceLabelForWacaBusinessPhone(
    phone10 === TELECRM_WACA_BUSINESS_PHONE || !phone10 ? TELECRM_WACA_BUSINESS_PHONE : phone10,
  );
}

export type TelecrmWhatsAppLeadInput = {
  phone: string;
  name?: string | null;
  messageText?: string | null;
  /** Business WA that received the msg — default 9167779696 (WACA / TeleCRM). */
  businessPhone?: string | null;
  city?: string | null;
  pincode?: string | null;
  telecrmId?: string | null;
  disposition?: string | null;
  leadTag?: string | null;
  leadStatus?: string | null;
  assigneePhone?: string | null;
  assigneeEmail?: string | null;
  assigneeName?: string | null;
  /** When true, TeleCRM assignee overrides message-trigger assignee. */
  preferTelecrmAssignee?: boolean;
};

/**
 * Create / enrich a Bookings `service_leads` row from a TeleCRM WhatsApp event
 * (e.g. WACA inbox 9167779696). Also runs message-trigger assignment.
 */
export async function upsertServiceLeadFromTelecrmWhatsApp(
  input: TelecrmWhatsAppLeadInput,
): Promise<{
  ok: boolean;
  created?: boolean;
  leadId?: string | null;
  assignedTo?: string | null;
  skipped?: string;
  error?: string;
}> {
  const phone10 = normalizePhone10(input.phone);
  if (phone10.length < 10) return { ok: false, skipped: 'invalid_phone' };

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: adminError || 'no_admin' };

  const nowIso = new Date().toISOString();
  const msg = sanitizeTelecrmInboundMessage(input.messageText);
  const businessPhone = normalizePhone10(input.businessPhone || TELECRM_WACA_BUSINESS_PHONE) || TELECRM_WACA_BUSINESS_PHONE;
  const wacaSource = wacaLeadSourceLabel(businessPhone);
  const name =
    String(input.name || '').trim() ||
    `WhatsApp ${phone10.slice(-4)}`;

  const { data: existingRows, error: findErr } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, status, coupon_meta, assigned_telecaller_id, customer_name, lead_source, created_from, problem_description')
    .or(
      `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`,
    )
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);

  if (findErr) {
    return { ok: false, error: findErr.message };
  }

  let assignedTo: string | null = null;
  let assignmentMode: string | null = null;
  let triggerId: string | null = null;
  let triggerLabel: string | null = null;
  let createdFrom = 'WHATSAPP';
  let leadSource = wacaSource;
  const telecrmAssigneeId = await resolveTelecallerUserId({
    phone: input.assigneePhone,
    email: input.assigneeEmail,
    name: input.assigneeName,
  });

  try {
    const picked = await pickTelecallerForLead({
      channel: 'WHATSAPP',
      messageText: msg,
      pincode: input.pincode || null,
    });
    if (picked.telecallerId) {
      assignedTo = picked.telecallerId;
      assignmentMode = picked.assignment_mode || null;
    }
    if (picked.trigger) {
      triggerId = picked.trigger.id;
      triggerLabel = picked.trigger.label || picked.trigger.phrase;
      if (picked.trigger.mark_as_meta) {
        createdFrom = 'WHATSAPP_META';
        leadSource = triggerLabel ? `Meta Ads · ${triggerLabel}` : 'Meta Ads';
      }
    }
  } catch (e) {
    console.warn('[telecrm→service_leads] assignment failed', e);
  }

  if (telecrmAssigneeId && (input.preferTelecrmAssignee !== false || !assignedTo)) {
    assignedTo = telecrmAssigneeId;
    assignmentMode = 'TELECRM_WORKFLOW';
  }

  const telecrmLeadStatus =
    String(input.leadStatus || input.disposition || '').trim() || null;
  const telecrmLeadTag = String(input.leadTag || '').trim() || null;

  const existing = existingRows?.[0] || null;

  if (existing?.id) {
    const prevMeta =
      existing.coupon_meta && typeof existing.coupon_meta === 'object'
        ? (existing.coupon_meta as Record<string, unknown>)
        : {};
    const prevAssignee = existing.assigned_telecaller_id
      ? String(existing.assigned_telecaller_id)
      : null;

    // Trigger match → force reassign; else keep existing assignee / fill if empty
    const nextAssignee =
      assignmentMode === 'MESSAGE_TRIGGER' && assignedTo
        ? assignedTo
        : prevAssignee || assignedTo;

    const patch: Record<string, unknown> = {
      updated_at: nowIso,
      coupon_meta: {
        ...prevMeta,
        whatsapp_inbound: true,
        whatsapp_enquiry: true,
        telecrm_whatsapp: true,
        wa_business_phone: businessPhone,
        wa_inbox: businessPhone,
        last_inbound_at: nowIso,
        telecrm_id: input.telecrmId || prevMeta.telecrm_id || null,
        telecrm_disposition: input.disposition || prevMeta.telecrm_disposition || null,
        telecrm_lead_tag: telecrmLeadTag || prevMeta.telecrm_lead_tag || null,
        telecrm_lead_status: telecrmLeadStatus || prevMeta.telecrm_lead_status || null,
        telecrm_assignee_name: input.assigneeName || prevMeta.telecrm_assignee_name || null,
        ...(triggerId
          ? {
              message_trigger_id: triggerId,
              message_trigger_label: triggerLabel,
              assignment_mode: assignmentMode,
            }
          : {}),
        ...(prevAssignee && nextAssignee && prevAssignee !== nextAssignee
          ? {
              previous_assigned_telecaller_id: prevAssignee,
              reassigned_by_trigger: assignmentMode === 'MESSAGE_TRIGGER',
              reassigned_at: nowIso,
            }
          : {}),
      },
    };

    if (msg) {
      patch.problem_description = msg;
      (patch.coupon_meta as Record<string, unknown>).last_inbound_message = msg;
    } else {
      const prevMsg = sanitizeTelecrmInboundMessage(
        prevMeta.last_inbound_message || prevMeta.first_message || existing.problem_description,
      );
      if (prevMsg) {
        (patch.coupon_meta as Record<string, unknown>).last_inbound_message = prevMsg;
      }
    }

    if (assignmentMode === 'MESSAGE_TRIGGER' && triggerLabel) {
      patch.lead_source = leadSource;
      patch.created_from = createdFrom;
    } else {
      patch.lead_source = wacaSource;
      patch.created_from = 'WHATSAPP';
    }

    if (nextAssignee && nextAssignee !== prevAssignee) {
      patch.assigned_telecaller_id = nextAssignee;
      patch.assigned_at = nowIso;
    }

    if (
      (!existing.customer_name || /^whatsapp\s*\d+/i.test(String(existing.customer_name))) &&
      name
    ) {
      patch.customer_name = name;
    }
    if (input.city) patch.city = input.city;
    if (input.pincode) patch.pincode = input.pincode;

    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    const { error: upErr } = await supabaseAdmin
      .from('service_leads')
      .update(patch)
      .eq('id', existing.id);

    if (upErr) return { ok: false, error: upErr.message };

    if (nextAssignee && nextAssignee !== prevAssignee) {
      void notifyTelecallerNewLeadAssignedSafe({
        leadId: String(existing.id),
        leadNumber: existing.lead_number ? String(existing.lead_number) : null,
        telecallerId: nextAssignee,
        previousTelecallerId: prevAssignee,
        assignedByName: 'TeleCRM / WhatsApp',
        notes: 'New WhatsApp lead',
      });
    }

    return {
      ok: true,
      created: false,
      leadId: String(existing.id),
      assignedTo: nextAssignee,
    };
  }

  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const descriptionParts = [
    `WhatsApp (${businessPhone})`,
    triggerLabel ? `Trigger: ${triggerLabel}` : null,
    msg ? `Msg: ${msg}` : null,
  ].filter(Boolean);

  const payload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: leadSource === wacaSource || !triggerLabel ? wacaSource : leadSource,
    created_from: createdFrom,
    status: 'NEW',
    customer_name: name,
    customer_phone: phone10,
    city: input.city || null,
    pincode: input.pincode || null,
    vehicle_number: 'NA',
    service_type: 'WhatsApp Enquiry',
    description: descriptionParts.join(' · '),
    problem_description: msg,
    is_incomplete: true,
    assigned_telecaller_id: assignedTo,
    assigned_at: assignedTo ? nowIso : null,
    coupon_meta: {
      whatsapp_inbound: true,
      whatsapp_enquiry: true,
      telecrm_whatsapp: true,
      wa_business_phone: businessPhone,
      wa_inbox: businessPhone,
      first_message: msg,
      last_inbound_message: msg,
      inbound_at: nowIso,
      last_inbound_at: nowIso,
      telecrm_id: input.telecrmId || null,
      telecrm_disposition: input.disposition || null,
      telecrm_lead_tag: telecrmLeadTag,
      telecrm_lead_status: telecrmLeadStatus,
      telecrm_assignee_name: input.assigneeName || null,
      message_trigger_id: triggerId,
      message_trigger_label: triggerLabel,
      assignment_mode: assignmentMode,
    },
    created_at: nowIso,
    updated_at: nowIso,
  };

  let { data: inserted, error: insertErr } = await supabaseAdmin
    .from('service_leads')
    .insert([payload])
    .select('id')
    .maybeSingle();

  if (insertErr && /is_incomplete|lead_priority|assigned_at|description/i.test(insertErr.message || '')) {
    const slim = { ...payload };
    delete slim.is_incomplete;
    delete slim.assigned_at;
    delete slim.description;
    ({ data: inserted, error: insertErr } = await supabaseAdmin
      .from('service_leads')
      .insert([slim])
      .select('id')
      .maybeSingle());
  }

  if (insertErr) return { ok: false, error: insertErr.message };

  if (inserted?.id && assignedTo) {
    void notifyTelecallerNewLeadAssignedSafe({
      leadId: String(inserted.id),
      leadNumber,
      telecallerId: assignedTo,
      assignedByName: 'TeleCRM / WhatsApp',
      notes: 'New WhatsApp lead',
    });
  }

  return {
    ok: true,
    created: true,
    leadId: inserted?.id ? String(inserted.id) : null,
    assignedTo,
  };
}

/** Keep a telecrm_api audit row for WACA / TeleCRM WhatsApp events. */
export async function ensureTelecrmApiRowForInbound(
  input: ParsedTelecrmWebhookPayload,
): Promise<{ id: string | null; created: boolean }> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.warn('[telecrm→telecrm_api] admin unavailable:', adminError);
    return { id: null, created: false };
  }

  const nowIso = new Date().toISOString();
  const phone10 = normalizePhone10(input.phone);
  const noteParts = [
    `WACA ${input.businessPhone || TELECRM_WACA_BUSINESS_PHONE}`,
    input.messageText ? `Msg: ${input.messageText.slice(0, 240)}` : null,
  ].filter(Boolean);

  if (input.telecrmId) {
    const { data: existing } = await supabaseAdmin
      .from('telecrm_api')
      .select('id')
      .eq('id', input.telecrmId)
      .maybeSingle();
    if (existing?.id) {
      await supabaseAdmin
        .from('telecrm_api')
        .update({
          name: input.name || undefined,
          mobile: phone10,
          city: input.city || undefined,
          pincode: input.pincode || undefined,
          disposition: input.disposition || undefined,
          service_type: input.serviceType || undefined,
          vehicle_model: input.vehicleModel || undefined,
          disposition_note: noteParts.join(' · ') || undefined,
          updated_at: nowIso,
        })
        .eq('id', existing.id);
      return { id: String(existing.id), created: false };
    }
  }

  const { data: latest } = await supabaseAdmin
    .from('telecrm_api')
    .select('id')
    .or(`mobile.eq.${phone10},mobile.eq.91${phone10}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.id && input.messageText) {
    await supabaseAdmin
      .from('telecrm_api')
      .update({
        disposition_note: noteParts.join(' · '),
        updated_at: nowIso,
      })
      .eq('id', latest.id);
    return { id: String(latest.id), created: false };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('telecrm_api')
    .insert({
      name: input.name || `WhatsApp ${phone10.slice(-4)}`,
      mobile: phone10,
      city: input.city,
      pincode: input.pincode,
      disposition: input.disposition || 'New',
      disposition_category: 'WhatsApp',
      service_type: input.serviceType || 'WhatsApp Enquiry',
      vehicle_model: input.vehicleModel,
      disposition_note: noteParts.join(' · '),
      updated_at: nowIso,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('[telecrm→telecrm_api] insert failed:', error.message);
    return { id: null, created: false };
  }

  return { id: inserted?.id ? String(inserted.id) : null, created: true };
}
