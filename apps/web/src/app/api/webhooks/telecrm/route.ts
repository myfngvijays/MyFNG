import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  createChaseInstanceFromTelecrmLead,
  processChaseAgentEvent,
} from '@/lib/whatsappAgents/chase/handler';
import { shouldChaseTelecrmLead, type TelecrmLeadCandidate } from '@/lib/whatsappAgents/chase/telecrmTriggers';
import { fetchAgentConfig } from '@/lib/whatsappAgents/shared/configStore';
import { normalizeAgentPhone } from '@/lib/whatsappAgents/shared/instanceService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function assertWebhookAuth(req: NextRequest): boolean {
  const secret = process.env.TELECRM_WEBHOOK_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return true; // dev fallback
  const header = req.headers.get('x-webhook-secret') || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return header === secret || bearer === secret;
}

export async function POST(request: NextRequest) {
  if (!assertWebhookAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const phone = normalizeAgentPhone(body?.phone || body?.mobile || '');
    if (!phone) {
      return NextResponse.json({ error: 'phone/mobile required' }, { status: 400 });
    }

    const config = await fetchAgentConfig('CHASE');
    if (!config.enabled) {
      return NextResponse.json({ success: true, skipped: true, reason: 'chase_disabled' });
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

    if (!shouldChaseTelecrmLead(lead, config)) {
      return NextResponse.json({ success: true, skipped: true, reason: 'disposition_not_eligible' });
    }

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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
