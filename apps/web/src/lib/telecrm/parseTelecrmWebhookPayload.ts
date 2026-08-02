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

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
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
    if (text) return text;
  }
  return null;
}

function normalizeBusinessPhone(raw: string | null | undefined): string {
  const digits = String(raw || TELECRM_WACA_BUSINESS_PHONE).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return TELECRM_WACA_BUSINESS_PHONE;
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

  const messageText = pickString(
    body.message,
    body.message_text,
    body.text,
    body.whatsapp_message,
    body.last_message,
    body.msg,
    body.note,
    body.inbound_message,
    body.last_inbound_message,
    dig(body, 'message.text', 'whatsapp.text', 'notification.message'),
    dig(fields, 'message', 'Message', 'Last Message', 'last_message', 'whatsapp_message'),
    dig(data, 'message', 'text', 'last_message'),
  );

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
    messageText: messageText ? messageText.slice(0, 1000) : null,
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
