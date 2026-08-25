import 'server-only';
import {
  ensureTelecrmApiRowForInbound,
  upsertServiceLeadFromTelecrmWhatsApp,
} from './upsertServiceLeadFromTelecrm';
import {
  isTelecrmIncomingCallPayload,
  parseTelecrmWebhookPayload,
  TELECRM_WACA_BUSINESS_PHONE,
  type ParsedTelecrmWebhookPayload,
} from './parseTelecrmWebhookPayload';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { upsertServiceLeadFromIncomingSarvCall } from '@/lib/sarv/upsertServiceLeadFromIncomingCall';

export type TelecrmWacaMirrorResult = {
  ok: boolean;
  parsed: ParsedTelecrmWebhookPayload | null;
  telecrmApi: Awaited<ReturnType<typeof ensureTelecrmApiRowForInbound>>;
  bookingsLead: Awaited<ReturnType<typeof upsertServiceLeadFromTelecrmWhatsApp>>;
};

export function buildTelecrmWacaApiTemplateBody() {
  return {
    phone: '{{Phone}}',
    name: '{{Name}}',
    // Option A: Call API immediately after Incoming Whatsapp → use {{Message Text}}
    // Option B: Call API at end → first save Message Text to lead field LAST_WA_MSG, then use {{LAST_WA_MSG}}
    message: '{{LAST_WA_MSG}}',
    last_wa_message: '{{LAST_WA_MSG}}',
    whatsapp_number: TELECRM_WACA_BUSINESS_PHONE,
    lead_tag: '{{LEADTAG}}',
    lead_status: '{{Lead Status}}',
    assignee_name: '{{Assignee}}',
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

  if (isTelecrmIncomingCallPayload(body, parsed)) {
    const { supabaseAdmin } = getSupabaseAdmin();
    const bookingsLead = await upsertServiceLeadFromIncomingSarvCall({
      db: supabaseAdmin,
      phone10: parsed.phone,
      callid: String(parsed.telecrmId || `telecrm-${parsed.phone}-${Date.now()}`),
      ctype: 'IBD',
      disposition: parsed.disposition || parsed.leadStatus,
    });
    return {
      ok: Boolean(bookingsLead.ok),
      parsed,
      telecrmApi,
      bookingsLead,
    };
  }

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
