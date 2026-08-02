import 'server-only';
import {
  ensureTelecrmApiRowForInbound,
  upsertServiceLeadFromTelecrmWhatsApp,
} from './upsertServiceLeadFromTelecrm';
import {
  parseTelecrmWebhookPayload,
  TELECRM_WACA_BUSINESS_PHONE,
  type ParsedTelecrmWebhookPayload,
} from './parseTelecrmWebhookPayload';

export type TelecrmWacaMirrorResult = {
  ok: boolean;
  parsed: ParsedTelecrmWebhookPayload | null;
  telecrmApi: Awaited<ReturnType<typeof ensureTelecrmApiRowForInbound>>;
  bookingsLead: Awaited<ReturnType<typeof upsertServiceLeadFromTelecrmWhatsApp>>;
};

export function buildTelecrmWacaApiTemplateBody() {
  return {
    phone: '{{phone}}',
    name: '{{name}}',
    message: '{{message}}',
    whatsapp_number: TELECRM_WACA_BUSINESS_PHONE,
    lead_tag: '{{LEADTAG}}',
    lead_status: '{{LeadStatus}}',
    assignee_name: '{{assignee.name}}',
    assignee_phone: '{{assignee.phone}}',
    assignee_email: '{{assignee.email}}',
  };
}

export async function mirrorTelecrmWacaInboundToBookings(
  body: Record<string, unknown>,
): Promise<TelecrmWacaMirrorResult> {
  const parsed = parseTelecrmWebhookPayload(body);
  if (!parsed) {
    return {
      ok: false,
      parsed: null,
      telecrmApi: { id: null, created: false },
      bookingsLead: { ok: false, skipped: 'invalid_phone' },
    };
  }

  const telecrmApi = await ensureTelecrmApiRowForInbound(parsed);
  const bookingsLead = await upsertServiceLeadFromTelecrmWhatsApp({
    phone: parsed.phone,
    name: parsed.name,
    messageText: parsed.messageText,
    businessPhone: parsed.businessPhone || TELECRM_WACA_BUSINESS_PHONE,
    city: parsed.city,
    pincode: parsed.pincode,
    telecrmId: telecrmApi.id || parsed.telecrmId,
    disposition: parsed.disposition || parsed.leadStatus,
    leadTag: parsed.leadTag,
    leadStatus: parsed.leadStatus,
    assigneePhone: parsed.assigneePhone,
    assigneeEmail: parsed.assigneeEmail,
    assigneeName: parsed.assigneeName,
    preferTelecrmAssignee: true,
  });

  return {
    ok: Boolean(bookingsLead.ok),
    parsed,
    telecrmApi,
    bookingsLead,
  };
}
