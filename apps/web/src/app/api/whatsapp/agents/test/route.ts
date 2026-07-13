import { NextRequest, NextResponse } from 'next/server';
import { processBookingAgentMessage } from '@/lib/whatsappAgents/booking/handler';
import { processChaseAgentEvent } from '@/lib/whatsappAgents/chase/handler';
import { runAgentCycle } from '@/lib/whatsappAgents/shared/agentRunner';
import type { AgentEventType, AgentType } from '@/lib/whatsappAgents/shared/types';
import { getDbWithAdmin, parseAgentType } from '@/app/api/whatsapp/agents/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const agentType = parseAgentType(String(body?.agent_type || ''));
    if (!agentType) {
      return NextResponse.json({ error: 'agent_type must be BOOKING, FOLLOWUP, or CHASE' }, { status: 400 });
    }

    const phone = String(body?.phone || '9999999999').replace(/\D/g, '').slice(-10);
    const eventType = String(body?.event_type || 'MANUAL_TRIGGER').toUpperCase() as AgentEventType;
    const customerMessage = body?.customer_message ? String(body.customer_message) : undefined;

    if (agentType === 'BOOKING') {
      const result = await processBookingAgentMessage({
        phone,
        message: customerMessage || 'Hi, I want to book periodic service for my Swift in 400001',
        dryRun: true,
        force: true,
      });
      return NextResponse.json({
        success: true,
        agent_type: agentType,
        reply: result.reply,
        route: result.route,
        booking_created: result.bookingCreated,
        pricing: result.pricing,
        skipped_reason: result.skippedReason,
        latency_ms: result.latencyMs,
      });
    }

    if (agentType === 'CHASE') {
      const result = await processChaseAgentEvent({
        phone,
        eventType: eventType === 'NEW_LEAD' ? 'NEW_LEAD' : 'SCHEDULED_WAKEUP',
        customerMessage,
        dryRun: true,
        force: true,
      });
      return NextResponse.json({
        success: true,
        agent_type: agentType,
        decision: result.decision,
        route: result.route,
        skipped_reason: result.skippedReason,
        latency_ms: result.latencyMs,
      });
    }

    const result = await runAgentCycle({
      agentType: agentType as AgentType,
      phone,
      eventType,
      dryRun: true,
      customerMessage,
      mockMemory: body?.mock_memory,
      mockCrm: body?.mock_crm,
    });

    return NextResponse.json({ success: true, agent_type: agentType, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
