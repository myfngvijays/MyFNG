import { performWhatsAppHandoff } from '@/lib/whatsappBotFlow/handoff';
import { activateBookingAgentFromChase } from '../booking/handler';
import { endInstance, updateInstance } from './instanceService';
import { scheduleWakeup, computeWaitUntil } from './schedulerService';
import { sendAgentOutboundMessage } from './outboundAgentMessage';
import { updateTelecrmFromAgent } from './telecrmSync';
import { saveMemory, loadMemory } from './memoryService';
import type { AgentConfig, AgentDecision, AgentInstance, ExecutionStatus } from './types';

export type ExecuteResult = {
  status: ExecutionStatus;
  message?: string;
  waitUntil?: string;
  error?: string;
};

export type ExecuteContext = {
  instance: AgentInstance;
  config: AgentConfig;
  phone: string;
  dryRun?: boolean;
  inboundAt?: string | null;
  customerMessage?: string;
};

export async function executeAction(
  decision: AgentDecision,
  context: ExecuteContext,
): Promise<ExecuteResult> {
  const { instance, config, phone, dryRun } = context;

  switch (decision.action) {
    case 'SEND_MESSAGE': {
      const message = String(decision.message || '').trim();
      if (!message) return { status: 'FAILED', error: 'Empty message' };

      if (dryRun) {
        return { status: 'SKIPPED', message: 'Dry run' };
      }

      const memory = await loadMemory(instance.id);
      const customerName =
        String(
          memory.lead_details?.name ||
            memory.crm_snapshot?.name ||
            instance.metadata?.telecrm_name ||
            'there',
        ).trim() || 'there';

      const send = await sendAgentOutboundMessage({
        phone,
        message,
        config,
        source: `whatsapp_${instance.agent_type.toLowerCase()}_agent`,
        inboundAt: context.inboundAt,
        meta: { instance_id: instance.id, customer_name: customerName },
      });

      if (!send.success) {
        return { status: 'FAILED', error: send.error || 'Send failed' };
      }

      const mem = memory;
      mem.sent_messages = [
        ...mem.sent_messages,
        { at: new Date().toISOString(), message, direction: 'outbound' },
      ].slice(-20);
      await saveMemory(mem);

      await updateInstance(instance.id, {
        follow_up_count: (instance.follow_up_count || 0) + 1,
        last_action_at: new Date().toISOString(),
        status: 'ACTIVE',
      });

      return { status: 'EXECUTED', message };
    }

    case 'WAIT': {
      const waitUntil = computeWaitUntil(decision);
      if (dryRun) {
        return { status: 'SKIPPED', waitUntil: waitUntil.toISOString() };
      }
      await scheduleWakeup({
        instanceId: instance.id,
        wakeAt: waitUntil,
        eventType: instance.agent_type === 'CHASE' ? 'CHASE_RETRY' : 'SCHEDULED_FOLLOWUP',
      });
      return { status: 'EXECUTED', waitUntil: waitUntil.toISOString() };
    }

    case 'UPDATE_CRM': {
      if (dryRun) return { status: 'SKIPPED' };
      await updateTelecrmFromAgent({
        telecrmId: instance.telecrm_id,
        phone,
        crmFields: decision.crm_fields || {},
        config,
        action: 'custom',
      });
      return { status: 'EXECUTED' };
    }

    case 'ASSIGN_TO_HUMAN': {
      if (dryRun) return { status: 'SKIPPED' };
      await performWhatsAppHandoff({
        phone,
        note: decision.assign_reason || 'Chase agent escalation',
        message: context.customerMessage,
      });
      await updateTelecrmFromAgent({
        telecrmId: instance.telecrm_id,
        phone,
        crmFields: {},
        config,
        action: 'on_escalation',
      });
      await updateInstance(instance.id, {
        status: 'ESCALATED',
        escalated_at: new Date().toISOString(),
      });
      return { status: 'EXECUTED' };
    }

    case 'ACTIVATE_BOOKING_BOT': {
      if (dryRun) return { status: 'SKIPPED' };
      await activateBookingAgentFromChase({
        phone,
        leadId: instance.lead_id,
        telecrmId: instance.telecrm_id,
        note: decision.reason,
      });
      await endInstance(instance.id, 'CONVERTED');
      return { status: 'EXECUTED' };
    }

    case 'END_CONVERSATION': {
      if (dryRun) return { status: 'SKIPPED' };
      const reason = decision.end_reason || 'MANUAL';
      if (reason.includes('max') || reason.includes('attempt')) {
        await updateTelecrmFromAgent({
          telecrmId: instance.telecrm_id,
          phone,
          crmFields: {},
          config,
          action: 'on_end_max_attempts',
        });
      }
      await endInstance(instance.id, reason === 'CONVERTED' ? 'CONVERTED' : 'MAX_ATTEMPTS');
      return { status: 'EXECUTED' };
    }

    case 'BOOK_APPOINTMENT': {
      if (dryRun) return { status: 'SKIPPED' };
      await activateBookingAgentFromChase({
        phone,
        leadId: instance.lead_id,
        telecrmId: instance.telecrm_id,
        note: 'Booking intent — handing to Booking Bot',
      });
      if (decision.message) {
        await sendAgentOutboundMessage({
          phone,
          message: decision.message,
          config,
          source: 'whatsapp_chase_agent',
          inboundAt: context.inboundAt,
        });
      }
      await endInstance(instance.id, 'CONVERTED');
      return { status: 'EXECUTED' };
    }

    default:
      return { status: 'FAILED', error: `Unknown action: ${decision.action}` };
  }
}

export async function logAgentAction(input: {
  instanceId: string;
  eventType: string;
  aiDecision: AgentDecision | null;
  validatedAction: string | null;
  executionStatus: ExecutionStatus;
  blockReason?: string;
  messageSent?: string;
  waitUntil?: string;
  latencyMs?: number;
}): Promise<void> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return;

    await supabaseAdmin.from('whatsapp_agent_actions').insert({
      instance_id: input.instanceId,
      event_type: input.eventType,
      ai_decision: input.aiDecision,
      validated_action: input.validatedAction,
      execution_status: input.executionStatus,
      block_reason: input.blockReason || null,
      message_sent: input.messageSent || null,
      wait_until: input.waitUntil || null,
      confidence: input.aiDecision?.confidence ?? null,
      reason: input.aiDecision?.reason ?? null,
      latency_ms: input.latencyMs ?? null,
    });
  } catch {
    // ignore
  }
}
