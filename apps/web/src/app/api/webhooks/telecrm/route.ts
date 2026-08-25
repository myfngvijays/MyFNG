import { NextRequest, NextResponse } from 'next/server';
import { fetchAgentConfig } from '@/lib/whatsappAgents/shared/configStore';
import { getDispositionRulesConfig } from '@/lib/whatsappAgents/shared/dispositionRules';
import { handleTelecrmDispositionEvent } from '@/lib/whatsappAgents/shared/telecrmDispositionHandler';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';
import type { TelecrmLeadCandidate } from '@/lib/whatsappAgents/chase/telecrmTriggers';
import { shouldChaseTelecrmLead } from '@/lib/whatsappAgents/chase/telecrmTriggers';
import {
  createChaseInstanceFromTelecrmLead,
  processChaseAgentEvent,
} from '@/lib/whatsappAgents/chase/handler';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  buildTelecrmWacaApiTemplateBody,
  mirrorTelecrmWacaInboundToBookings,
} from '@/lib/telecrm/wacaBookingsMirror';
import { summarizeTelecrmMessageDebug } from '@/lib/telecrm/parseTelecrmWebhookPayload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertWebhookAuth(req: NextRequest): Promise<boolean> {
  const creds = await getResolvedWhatsAppAgentsCredentials();
  const secret = creds.telecrm_webhook_secret || creds.cron_secret || '';
  if (!secret) return true;
  const header = req.headers.get('x-webhook-secret') || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return header === secret || bearer === secret;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/telecrm',
    purpose:
      'Mirror TeleCRM WhatsApp (9167779696) and incoming Sarv/call leads into Bookings & Leads admin. Does not push anything back to TeleCRM.',
    auth: 'Header x-webhook-secret or Authorization: Bearer <TELECRM_WEBHOOK_SECRET>',
    telecrm_workflow: {
      event: 'WhatsApp → On WhatsApp Received Notification',
      action: 'Custom Action / API Template → HTTP POST to this URL',
      note: 'Without this workflow, 9167779696 chats stay only inside TeleCRM and never reach MyFNG admin.',
    },
    sample_body: buildTelecrmWacaApiTemplateBody(),
    telecrm_template: {
      name: 'Whatsapp_Admin_Panel_Trigger',
      method: 'POST',
      url: 'https://www.myfng.in/api/webhooks/telecrm',
      headers: {
        'Content-type': 'application/json',
        'x-webhook-secret': '<TELECRM_WEBHOOK_SECRET from Bot Flow Env Settings>',
      },
      body: buildTelecrmWacaApiTemplateBody(),
      timeout_seconds: 15,
      workflow_hint:
        'Put Call API immediately after Incoming Whatsapp trigger (before tag/assign). Message Text is empty at workflow end.',
    },
    incoming_call_template: {
      name: 'Incoming_Sarv_Admin_Panel_Trigger',
      method: 'POST',
      url: 'https://www.myfng.in/api/webhooks/telecrm',
      headers: {
        'Content-type': 'application/json',
        'x-webhook-secret': '<TELECRM_WEBHOOK_SECRET from Bot Flow Env Settings>',
      },
      body: {
        phone: '{{Phone}}',
        name: '{{Name}}',
        channel: 'sarv_incoming',
        lead_source: '{{LeadSource}}',
        lead_status: '{{Lead Status}}',
        lead_tag: '{{LEADTAG}}',
      },
      workflow_hint:
        'Trigger: Incoming call / new lead (Sarv). Same URL as WhatsApp. This only copies the lead into MyFNG admin — it does not change TeleCRM.',
    },
    message_debug_hint:
      'POST response includes message_debug.parsed_message — must show real text in Test Template before Publish.',
  });
}

export async function POST(request: NextRequest) {
  if (!(await assertWebhookAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const messageDebug = summarizeTelecrmMessageDebug(body);
    const mirror = await mirrorTelecrmWacaInboundToBookings(body);
    if (!mirror.parsed) {
      return NextResponse.json(
        {
          error: 'phone/mobile required',
          hint: 'Send phone, mobile, or lead.phone in JSON body',
          received_keys: Object.keys(body || {}),
        },
        { status: 400 },
      );
    }

    const parsed = mirror.parsed;
    const phone = parsed.phone;
    const telecrmRow = mirror.telecrmApi;
    const bookingsLead = mirror.bookingsLead;

    if (!bookingsLead.ok) {
      return NextResponse.json(
        {
          success: false,
          error: bookingsLead.error || bookingsLead.skipped || 'bookings_sync_failed',
          telecrm_api: telecrmRow,
          bookings_lead: bookingsLead,
        },
        { status: 422 },
      );
    }

    console.log('[telecrm-webhook] bookings lead sync', {
      phone,
      businessPhone: parsed.businessPhone,
      created: bookingsLead.created,
      leadId: bookingsLead.leadId,
      assignedTo: bookingsLead.assignedTo,
      telecrmApiId: telecrmRow.id,
      messageCaptured: Boolean(parsed.messageText),
    });
    if (!parsed.messageText) {
      console.warn('[telecrm-webhook] inbound message missing — TeleCRM body.message is empty/undefined. Use Message Text variable, not ACTION_text at workflow end.');
    }
    const chaseConfig = await fetchAgentConfig('CHASE');
    const followupConfig = await fetchAgentConfig('FOLLOWUP');
    if (!chaseConfig.enabled && !followupConfig.enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'agents_disabled',
        message_debug: messageDebug,
        telecrm_api: telecrmRow,
        bookings_lead: bookingsLead,
      });
    }

    const lead: TelecrmLeadCandidate = {
      id: String(telecrmRow.id || parsed.telecrmId || ''),
      name: parsed.name,
      mobile: phone,
      city: parsed.city,
      pincode: parsed.pincode,
      disposition: parsed.disposition || 'New',
      service_type: parsed.serviceType,
      vehicle_model: parsed.vehicleModel,
      created_at: new Date().toISOString(),
    };

    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin && !lead.id) {
      const { data } = await supabaseAdmin
        .from('telecrm_api')
        .select('id')
        .eq('mobile', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) lead.id = data.id;
    }

    const { enabled: rulesEnabled } = getDispositionRulesConfig(chaseConfig);
    if (rulesEnabled && lead.disposition) {
      const result = await handleTelecrmDispositionEvent({
        row: lead,
        eventKind: 'new_lead',
      });
      return NextResponse.json({
        success: true,
        disposition_rules: true,
        handled: result.handled,
        rule_id: result.ruleId,
        bot: result.bot,
        message_mode: result.messageMode,
        instance_id: result.instanceId,
        skipped_reason: result.skippedReason,
        message_debug: messageDebug,
        telecrm_api: telecrmRow,
        bookings_lead: bookingsLead,
      });
    }

    if (!shouldChaseTelecrmLead(lead, chaseConfig)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'disposition_not_eligible',
        message_debug: messageDebug,
        telecrm_api: telecrmRow,
        bookings_lead: bookingsLead,
      });
    }

    const instance = await createChaseInstanceFromTelecrmLead(lead);
    if (!instance) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'instance_not_created',
        message_debug: messageDebug,
        telecrm_api: telecrmRow,
        bookings_lead: bookingsLead,
      });
    }

    const result = await processChaseAgentEvent({
      phone,
      eventType: 'NEW_LEAD',
      telecrmId: lead.id || instance.telecrm_id,
      instance,
    });

    return NextResponse.json({
      success: true,
      chase_instance_created: true,
      instance_id: instance.id,
      handled: result.handled,
      decision: result.decision,
      message_debug: messageDebug,
      telecrm_api: telecrmRow,
      bookings_lead: bookingsLead,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
