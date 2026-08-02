import { NextRequest, NextResponse } from 'next/server';
import { fetchAgentConfig } from '@/lib/whatsappAgents/shared/configStore';
import { getDispositionRulesConfig } from '@/lib/whatsappAgents/shared/dispositionRules';
import { handleTelecrmDispositionEvent } from '@/lib/whatsappAgents/shared/telecrmDispositionHandler';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';
import { normalizeAgentPhone } from '@/lib/whatsappAgents/shared/instanceService';
import type { TelecrmLeadCandidate } from '@/lib/whatsappAgents/chase/telecrmTriggers';
import { shouldChaseTelecrmLead } from '@/lib/whatsappAgents/chase/telecrmTriggers';
import {
  createChaseInstanceFromTelecrmLead,
  processChaseAgentEvent,
} from '@/lib/whatsappAgents/chase/handler';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  ensureTelecrmApiRowForInbound,
  upsertServiceLeadFromTelecrmWhatsApp,
} from '@/lib/telecrm/upsertServiceLeadFromTelecrm';
import {
  parseTelecrmWebhookPayload,
  TELECRM_WACA_BUSINESS_PHONE,
} from '@/lib/telecrm/parseTelecrmWebhookPayload';

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
    purpose: 'Mirror TeleCRM / WACA WhatsApp (9167779696) into Bookings & Leads admin',
    auth: 'Header x-webhook-secret or Authorization: Bearer <TELECRM_WEBHOOK_SECRET>',
    telecrm_workflow: {
      event: 'WhatsApp → On WhatsApp Received Notification',
      action: 'Custom Action / API Template → HTTP POST to this URL',
      note: 'Without this workflow, 9167779696 chats stay only inside TeleCRM and never reach MyFNG admin.',
    },
    sample_body: {
      phone: '9876543210',
      name: 'Customer Name',
      message: 'Hi, need car service',
      whatsapp_number: TELECRM_WACA_BUSINESS_PHONE,
      disposition: 'New',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!(await assertWebhookAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseTelecrmWebhookPayload(body);
    if (!parsed) {
      return NextResponse.json(
        {
          error: 'phone/mobile required',
          hint: 'Send phone, mobile, or lead.phone in JSON body',
          received_keys: Object.keys(body || {}),
        },
        { status: 400 },
      );
    }

    const telecrmRow = await ensureTelecrmApiRowForInbound(parsed);

    let bookingsLead: Awaited<ReturnType<typeof upsertServiceLeadFromTelecrmWhatsApp>> | null = null;
    try {
      bookingsLead = await upsertServiceLeadFromTelecrmWhatsApp({
        phone: parsed.phone,
        name: parsed.name,
        messageText: parsed.messageText,
        businessPhone: parsed.businessPhone || TELECRM_WACA_BUSINESS_PHONE,
        city: parsed.city,
        pincode: parsed.pincode,
        telecrmId: telecrmRow.id || parsed.telecrmId,
        disposition: parsed.disposition,
      });
      console.log('[telecrm-webhook] bookings lead sync', {
        phone: parsed.phone,
        businessPhone: parsed.businessPhone,
        created: bookingsLead.created,
        leadId: bookingsLead.leadId,
        assignedTo: bookingsLead.assignedTo,
        skipped: bookingsLead.skipped,
        error: bookingsLead.error,
        telecrmApiId: telecrmRow.id,
      });
    } catch (syncErr: unknown) {
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.error('[telecrm-webhook] bookings lead sync failed:', msg);
      bookingsLead = { ok: false, error: msg };
    }

    if (!bookingsLead?.ok) {
      return NextResponse.json(
        {
          success: false,
          error: bookingsLead?.error || bookingsLead?.skipped || 'bookings_sync_failed',
          telecrm_api: telecrmRow,
          bookings_lead: bookingsLead,
        },
        { status: 422 },
      );
    }

    const phone = parsed.phone;
    const chaseConfig = await fetchAgentConfig('CHASE');
    const followupConfig = await fetchAgentConfig('FOLLOWUP');
    if (!chaseConfig.enabled && !followupConfig.enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'agents_disabled',
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
        telecrm_api: telecrmRow,
        bookings_lead: bookingsLead,
      });
    }

    if (!shouldChaseTelecrmLead(lead, chaseConfig)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'disposition_not_eligible',
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
      telecrm_api: telecrmRow,
      bookings_lead: bookingsLead,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
