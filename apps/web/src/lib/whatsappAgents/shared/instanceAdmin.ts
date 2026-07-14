import { performWhatsAppHandoff } from '@/lib/whatsappBotFlow/handoff';
import { fetchAgentConfig } from './configStore';
import { logAgentAction } from './executeAction';
import { cancelWakeup } from './schedulerService';
import { updateTelecrmFromAgent } from './telecrmSync';
import { getInstanceById, updateInstance } from './instanceService';
import type { AgentInstance } from './types';

export async function pauseInstance(
  instanceId: string,
  reason?: string,
): Promise<AgentInstance> {
  const instance = await getInstanceById(instanceId);
  if (!instance) throw new Error('Instance not found');

  if (!['ACTIVE', 'WAITING'].includes(instance.status)) {
    throw new Error(`Cannot pause instance with status ${instance.status}`);
  }

  await cancelWakeup(instanceId);
  await updateInstance(instanceId, {
    status: 'PAUSED',
    next_wakeup_at: null,
    metadata: {
      ...instance.metadata,
      pause_reason: reason || 'Paused by admin',
      paused_at: new Date().toISOString(),
    },
  });

  await logAgentAction({
    instanceId,
    eventType: 'ADMIN_PAUSE',
    aiDecision: null,
    validatedAction: 'PAUSE',
    executionStatus: 'EXECUTED',
    blockReason: reason || null,
  });

  const updated = await getInstanceById(instanceId);
  return updated!;
}

export async function escalateInstance(
  instanceId: string,
  input?: { note?: string; assignTo?: string },
): Promise<AgentInstance> {
  const instance = await getInstanceById(instanceId);
  if (!instance) throw new Error('Instance not found');

  if (['ENDED', 'ESCALATED'].includes(instance.status)) {
    throw new Error(`Cannot escalate instance with status ${instance.status}`);
  }

  const config = await fetchAgentConfig(instance.agent_type);
  const note = input?.note || 'Escalated by admin';

  await performWhatsAppHandoff({
    phone: instance.phone,
    note,
  });

  if (instance.telecrm_id) {
    await updateTelecrmFromAgent({
      telecrmId: instance.telecrm_id,
      phone: instance.phone,
      crmFields: {},
      config,
      action: 'on_escalation',
    });
  }

  await cancelWakeup(instanceId);
  await updateInstance(instanceId, {
    status: 'ESCALATED',
    escalated_at: new Date().toISOString(),
    next_wakeup_at: null,
    metadata: {
      ...instance.metadata,
      escalation_note: note,
      escalated_by_admin: true,
      ...(input?.assignTo ? { escalated_to: input.assignTo } : {}),
    },
  });

  await logAgentAction({
    instanceId,
    eventType: 'ADMIN_ESCALATE',
    aiDecision: null,
    validatedAction: 'ASSIGN_TO_HUMAN',
    executionStatus: 'EXECUTED',
    blockReason: note,
  });

  const updated = await getInstanceById(instanceId);
  return updated!;
}
