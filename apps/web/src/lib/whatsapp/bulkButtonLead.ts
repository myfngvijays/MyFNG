import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { findLatestServiceLeadByPhone } from '@/lib/service-lead-reopen';
import { addLeadTags, ensureTagIdsByNames } from '@/lib/telecaller/crmLeadTagsApply';

function phone91(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return '';
  return `91${last10}`;
}

export function extractTemplateButtonLabel(inbound: any): string {
  const button = inbound?.button;
  if (button && typeof button === 'object') {
    const text = String(button.text || button.payload || '').trim();
    if (text) return text;
  }
  const reply = inbound?.interactive?.button_reply;
  if (reply && typeof reply === 'object') {
    return String(reply.title || reply.id || '').trim();
  }
  return '';
}

export async function applyBulkWhatsAppButtonReply(input: {
  phone: string;
  inbound: any;
  profileName?: string | null;
}) {
  const label = extractTemplateButtonLabel(input.inbound);
  const phone = phone91(input.phone);
  if (!label || !phone) return { matched: false };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { matched: false };
  const db = supabaseAdmin as any;

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const last10 = phone.slice(-10);
  const recipients = await db
    .from('wa_bulk_recipients')
    .select('id, campaign_id, name, sent_at')
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(8);
  const recipient = recipients.data?.[0] || null;
  let campaign: { id: string; name?: string; template_name?: string; button_map?: unknown } | null = null;
  if (recipient?.campaign_id) {
    const campaigns = await db
      .from('wa_bulk_campaigns')
      .select('id, name, template_name, button_map')
      .eq('id', recipient.campaign_id)
      .maybeSingle();
    campaign = campaigns.data || null;
  }

  const recentTemplate = await db
    .from('whatsapp_messages')
    .select('template_name, created_at')
    .eq('direction', 'OUTBOUND')
    .eq('message_type', 'TEMPLATE')
    .or(`recipient_phone.eq.${phone},recipient_phone.eq.${last10},recipient_phone.eq.91${last10}`)
    .order('created_at', { ascending: false })
    .limit(6);
  const sentTemplate = (recentTemplate.data || []).find((row: { template_name?: string }) => String(row.template_name || '').trim());
  const campaignAt = recipient?.sent_at ? new Date(recipient.sent_at).getTime() : 0;
  const templateAt = sentTemplate?.created_at ? new Date(sentTemplate.created_at).getTime() : 0;
  const templateName =
    templateAt >= campaignAt && sentTemplate?.template_name
      ? String(sentTemplate.template_name).trim()
      : String(campaign?.template_name || sentTemplate?.template_name || '').trim();
  if (!templateName) return { matched: false };

  const wanted = label.toLowerCase();
  const buttonMap = (Array.isArray(campaign?.button_map) ? campaign?.button_map : []) as any[];
  const mapping = buttonMap.find(
    (item: any) => String(item?.text || '').trim().toLowerCase() === wanted,
  );
  const createsLead = mapping?.action === 'create_lead';
  const tag = String(mapping?.tag || label).trim() || label;
  let createdLeadId: string | null = null;

  if (recipient?.id) {
    await db
      .from('wa_bulk_recipients')
      .update({ reply_button: label, replied_at: new Date().toISOString() })
      .eq('id', recipient.id);
  }

  if (createsLead) {
  const phone10 = phone.slice(-10);
  const contact = await db.from('wa_bulk_contacts').select('name, fields').eq('phone', phone).maybeSingle();
  const fields = contact.data?.fields && typeof contact.data.fields === 'object' ? contact.data.fields : {};
  const carNumber = String(fields.car_number || fields.vehicle_number || fields.car_no || '').trim();
  let lead = await findLatestServiceLeadByPhone(db, phone10);
  const note = `WhatsApp button “${label}” on ${templateName}`;
  if (!lead?.id) {
    const now = new Date().toISOString();
    const inserted = await db
      .from('service_leads')
      .insert({
        lead_number: `L-WA${Date.now().toString().slice(-8)}`,
        lead_type: 'NORMAL',
        lead_source: 'WhatsApp',
        created_from: 'WHATSAPP',
        status: 'NEW',
        customer_name: contact.data?.name || input.profileName || recipient?.name || `WhatsApp ${phone10.slice(-4)}`,
        customer_phone: phone10,
        vehicle_number: carNumber ? carNumber.slice(0, 20) : 'NA',
        service_type: 'Car Service',
        description: note,
        problem_description: label,
        lead_priority: 'NORMAL',
        telecaller_remarks: note,
        coupon_meta: {
          whatsapp_bulk: true,
          whatsapp_button: label,
          last_call_label: label,
          bulk_campaign_id: campaign?.id || null,
        },
        created_at: now,
        updated_at: now,
      })
      .select('id, lead_number, coupon_meta')
      .maybeSingle();
    lead = inserted.data;
    createdLeadId = lead?.id ? String(lead.id) : null;
  } else {
    const prev =
      lead.coupon_meta && typeof lead.coupon_meta === 'object' && !Array.isArray(lead.coupon_meta)
        ? lead.coupon_meta
        : {};
    await db
      .from('service_leads')
      .update({
        problem_description: label,
        telecaller_remarks: note,
        lead_source: lead.lead_source || 'WhatsApp',
        coupon_meta: {
          ...prev,
          whatsapp_bulk: true,
          whatsapp_button: label,
          last_call_label: label,
          bulk_campaign_id: campaign?.id || null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);
    createdLeadId = String(lead.id);
  }

  if (lead?.id) {
    try {
      const tagIds = await ensureTagIdsByNames([tag, 'WhatsApp Bulk'], { parentName: 'WhatsApp Bulk' });
      if (tagIds.length) await addLeadTags(String(lead.id), tagIds);
    } catch {
      // Tagging is extra. The lead row is the part TeleCRM needs.
    }
  }
  }

  let flowId: string | null = null;
  let flowStarted = false;
  try {
    const mappingRows = await db
      .from('wa_bulk_button_flows')
      .select('button_text, bot_flow_id')
      .eq('template_name', templateName);
    const mappingRow = (mappingRows.data || []).find(
      (row: { button_text?: string }) => String(row.button_text || '').trim().toLowerCase() === wanted,
    );
    flowId = mappingRow?.bot_flow_id ? String(mappingRow.bot_flow_id) : null;
    if (flowId) {
      const contact = await db.from('wa_bulk_contacts').select('name, fields').eq('phone', phone).maybeSingle();
      const fields = contact.data?.fields && typeof contact.data.fields === 'object' ? contact.data.fields : {};
      const { executeBotFlow } = await import('@/lib/whatsappBotFlow/executor');
      const { DEFAULT_WHATSAPP_BRAIN_CONFIG } = await import('@/lib/whatsappBotFlow/brainConfig');
      const run = await executeBotFlow({
        phone,
        message: label,
        profileName: input.profileName || contact.data?.name || recipient?.name || null,
        config: DEFAULT_WHATSAPP_BRAIN_CONFIG,
        inboundReceivedAt: new Date().toISOString(),
        flowId,
        forceStart: true,
        extraVariables: {
          name: String(contact.data?.name || recipient?.name || input.profileName || ''),
          button: label,
          template: templateName,
          ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value ?? '')])),
        },
      });
      flowStarted = Boolean(run.handled || run.sent);
    }
  } catch (error) {
    console.error('[bulk-button-flow]', error);
  }

  return { matched: true, leadId: createdLeadId, button: label, flowId, flowStarted };
}
