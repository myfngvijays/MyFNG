import { normalizeAgentPhone } from '@/lib/whatsappAgents/shared/instanceService';

export const TELECRM_WACA_BUSINESS_PHONE = '9167779696';

export type ParsedTelecrmWebhookPayload = {
  phone: string;
  name: string | null;
  messageText: string | null;
  businessPhone: string;
  city: string | null;
  pincode: string | null;
  telecrmId: string | null;
  disposition: string | null;
  serviceType: string | null;
  vehicleModel: string | null;
  leadTag: string | null;
  leadStatus: string | null;
  assigneePhone: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
};

function isPlaceholderValue(text: string): boolean {
  const t = text.trim().toLowerCase();
  return !t || t === 'undefined' || t === 'null' || /^\{\{.+\}\}$/.test(t);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && !isPlaceholderValue(text)) return text;
  }
  return null;
}

function dig(obj: unknown, ...paths: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  for (const path of paths) {
    const parts = path.split('.');
    let cur: unknown = record;
    for (const part of parts) {
      if (!cur || typeof cur !== 'object') {
        cur = null;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    const text = String(cur ?? '').trim();
    if (text && !isPlaceholderValue(text)) return text;
  }
  return null;
}

/** Pull inbound WhatsApp text from any common TeleCRM Call API body shape. */
export function extractTelecrmInboundMessage(body: Record<string, unknown>): string | null {
  const lead = body.lead && typeof body.lead === 'object' ? (body.lead as Record<string, unknown>) : null;
  const fields =
    body.fields && typeof body.fields === 'object' ? (body.fields as Record<string, unknown>) : null;
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null;

  const direct = pickString(
    body.message,
    body.Message,
    body.message_text,
    body.messageText,
    body['Message Text'],
    body['Message text'],
    body['message text'],
    body.text,
    body.Text,
    body.ACTION_text,
    body.action_text,
    body.whatsapp_message,
    body.last_message,
    body.Last_Message,
    body.msg,
    body.note,
    body.inbound_message,
    body.last_inbound_message,
    body.incoming_message,
    body.Incoming_Message,
    body.last_wa_message,
    body.last_wa_msg,
    body.LAST_WA_MSG,
    body.LAST_INBOUND_WA,
    body.customer_message,
    body.latest_message,
    dig(body, 'message.text', 'whatsapp.text', 'notification.message', 'activity.text', 'event.text'),
    dig(fields, 'message', 'Message', 'ACTION_text', 'Message Text', 'Last Message', 'last_message', 'whatsapp_message', 'Incoming Message', 'LAST_WA_MSG', 'last_wa_message'),
    dig(data, 'message', 'text', 'last_message', 'ACTION_text', 'Message Text', 'LAST_WA_MSG'),
    dig(lead, 'last_message', 'message', 'Message', 'LAST_WA_MSG', 'last_wa_message'),
  );
  if (direct) return sanitizeTelecrmInboundMessage(direct);

  // Last resort: any string field whose key looks message-related (TeleCRM custom mappings).
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') continue;
    if (!/message|text|whatsapp|inbound|incoming|action|wa_msg/i.test(key)) continue;
    if (/number|phone|secret|token|status|tag|assignee|name|email|url/i.test(key)) continue;
    const parsed = sanitizeTelecrmInboundMessage(value);
    if (parsed) return parsed;
  }

  return deepScanTelecrmMessage(body);
}

function deepScanTelecrmMessage(body: Record<string, unknown>): string | null {
  const skipKey = /phone|mobile|secret|token|status|tag|assignee|email|name|whatsapp_number|url|lead_id|telecrm_id|pincode|city/i;
  const candidates: string[] = [];

  const walk = (obj: unknown, depth = 0) => {
    if (depth > 5 || obj == null) return;
    if (typeof obj === 'string') {
      const t = obj.trim();
      if (t.length < 12 || isPlaceholderValue(t)) return;
      const digits = t.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 13 && digits === t.replace(/\s/g, '')) return;
      candidates.push(t);
      return;
    }
    if (typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (skipKey.test(key)) continue;
      walk(value, depth + 1);
    }
  };

  walk(body);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ? sanitizeTelecrmInboundMessage(candidates[0]) : null;
}

export function summarizeTelecrmMessageDebug(body: Record<string, unknown>): Record<string, unknown> {
  const parsed = extractTelecrmInboundMessage(body);
  const candidates: Record<string, unknown> = {};
  for (const key of [
    'message',
    'Message',
    'message_text',
    'Message Text',
    'ACTION_text',
    'text',
    'last_message',
    'incoming_message',
    'LAST_WA_MSG',
    'last_wa_message',
  ]) {
    if (key in body) candidates[key] = body[key];
  }
  return {
    parsed_message: parsed,
    candidate_fields: candidates,
    received_keys: Object.keys(body || {}),
    hint:
      parsed
        ? null
        : 'Message empty. Fix A: Call API right after Incoming Whatsapp. Fix B: add Update Lead Fields (LAST_WA_MSG = Message Text) after trigger, then body message = {{LAST_WA_MSG}}.',
  };
}

function normalizeBusinessPhone(raw: string | null | undefined): string {
  let digits = String(raw || TELECRM_WACA_BUSINESS_PHONE).replace(/\D/g, '');
  if (!digits) return TELECRM_WACA_BUSINESS_PHONE;
  // 919167779696 → 9167779696 (slice(-10) alone wrongly yields 6777969696)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  if (digits === TELECRM_WACA_BUSINESS_PHONE || digits === '9594996161') return digits;
  if (!raw || !String(raw).trim()) return TELECRM_WACA_BUSINESS_PHONE;
  return digits.length === 10 ? digits : TELECRM_WACA_BUSINESS_PHONE;
}

export function sanitizeTelecrmInboundMessage(raw: unknown): string | null {
  const text = pickString(raw);
  return text ? text.slice(0, 1000) : null;
}

export function parseTelecrmWebhookPayload(body: Record<string, unknown>): ParsedTelecrmWebhookPayload | null {
  const lead = body.lead && typeof body.lead === 'object' ? (body.lead as Record<string, unknown>) : null;
  const fields =
    body.fields && typeof body.fields === 'object' ? (body.fields as Record<string, unknown>) : null;
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null;

  const phoneRaw = pickString(
    body.phone,
    body.mobile,
    body.Phone,
    body.Mobile,
    body.customer_phone,
    body.customerPhone,
    dig(body, 'lead.phone', 'lead.mobile', 'lead.Phone', 'lead.Mobile'),
    dig(fields, 'Phone', 'phone', 'Mobile', 'mobile'),
    dig(data, 'phone', 'mobile', 'Phone', 'Mobile'),
    lead?.phone,
    lead?.mobile,
    lead?.Phone,
    lead?.Mobile,
  );

  const phone = normalizeAgentPhone(phoneRaw || '');
  if (!phone) return null;

  const messageText = extractTelecrmInboundMessage(body);

  const name = pickString(
    body.name,
    body.Name,
    body.customer_name,
    body.customerName,
    dig(body, 'lead.name', 'lead.Name'),
    dig(fields, 'Name', 'name', 'Customer Name'),
    dig(data, 'name', 'Name'),
    lead?.name,
    lead?.Name,
  );

  const businessPhone = normalizeBusinessPhone(
    pickString(
      body.whatsapp_number,
      body.waca_number,
      body.business_phone,
      body.inbox_phone,
      body.wa_number,
      dig(fields, 'whatsapp_number', 'business_phone'),
      dig(data, 'whatsapp_number', 'business_phone'),
    ),
  );

  return {
    phone,
    name,
    messageText,
    businessPhone,
    city: pickString(body.city, body.City, dig(fields, 'City', 'city'), dig(data, 'city'), lead?.city),
    pincode: pickString(body.pincode, body.Pincode, dig(fields, 'Pincode', 'pincode'), dig(data, 'pincode'), lead?.pincode),
    telecrmId: pickString(body.telecrm_id, body.lead_id, body.id, dig(body, 'lead.id'), dig(data, 'id')),
    disposition: pickString(
      body.disposition,
      body.LeadStatus,
      body.status,
      body.lead_status,
      dig(fields, 'LeadStatus', 'disposition'),
      dig(data, 'disposition', 'LeadStatus'),
    ),
    serviceType: pickString(body.service_type, body.serviceType, dig(fields, 'service_type'), lead?.service_type),
    vehicleModel: pickString(body.vehicle_model, body.vehicleModel, dig(fields, 'vehicle_model'), lead?.vehicle_model),
    leadTag: pickString(
      body.lead_tag,
      body.LEADTAG,
      body.leadTag,
      dig(fields, 'LEADTAG', 'lead_tag', 'Lead Tag'),
      dig(data, 'LEADTAG', 'lead_tag'),
    ),
    leadStatus: pickString(
      body.lead_status,
      body.LeadStatus,
      body.disposition,
      dig(fields, 'LeadStatus', 'lead_status'),
    ),
    assigneePhone: pickString(
      body.assignee_phone,
      body.assignee_mobile,
      body.telecaller_phone,
      dig(fields, 'assignee_phone', 'Assignee Phone'),
      dig(body, 'assignee.phone'),
    ),
    assigneeEmail: pickString(body.assignee_email, body.assigneeEmail, dig(fields, 'assignee_email')),
    assigneeName: pickString(
      body.assignee_name,
      body.assignee,
      body.telecaller_name,
      dig(fields, 'assignee_name', 'Assignee'),
      dig(body, 'assignee.name'),
    ),
  };
}

export function leadSourceLabelForWacaBusinessPhone(businessPhone: string): string {
  const last10 = normalizeBusinessPhone(businessPhone);
  if (last10 === TELECRM_WACA_BUSINESS_PHONE) return 'WhatsApp (9167779696)';
  if (last10 === '9594996161') return 'WhatsApp (9594996161)';
  return 'WhatsApp';
}
