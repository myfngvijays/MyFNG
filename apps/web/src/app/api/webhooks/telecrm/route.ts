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

export async function POST(request: NextRequest) {
  if (!(await assertWebhookAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const phone = normalizeAgentPhone(body?.phone || body?.mobile || '');
    if (!phone) {
      return NextResponse.json({ error: 'phone/mobile required' }, { status: 400 });
    }

    const chaseConfig = await fetchAgentConfig('CHASE');
    const followupConfig = await fetchAgentConfig('FOLLOWUP');
    if (!chaseConfig.enabled && !followupConfig.enabled) {
      return NextResponse.json({ success: true, skipped: true, reason: 'agents_disabled' });
    }

    const lead: TelecrmLeadCandidate = {
      id: String(body?.telecrm_id || body?.id || ''),
      name: body?.name ? String(body.name) : null,
      mobile: phone,
      city: body?.city ? String(body.city) : null,
      pincode: body?.pincode ? String(body.pincode) : null,
      disposition: body?.disposition ? String(body.disposition) : 'New',
      service_type: body?.service_type ? String(body.service_type) : null,
      vehicle_model: body?.vehicle_model ? String(body.vehicle_model) : null,
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
      });
    }

    if (!shouldChaseTelecrmLead(lead, chaseConfig)) {
      return NextResponse.json({ success: true, skipped: true, reason: 'disposition_not_eligible' });
    }

    const instance = await createChaseInstanceFromTelecrmLead(lead);
    if (!instance) {
      return NextResponse.json({ success: true, skipped: true, reason: 'instance_not_created' });
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
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
