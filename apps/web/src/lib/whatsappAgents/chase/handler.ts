import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { throttleCronSends } from '../shared/cronThrottle';
import { fetchAgentConfig } from '../shared/configStore';
import { runAgentCycle } from '../shared/agentRunner';
import {
  findOrCreateInstance,
  getActiveInstance,
  normalizeAgentPhone,
  updateInstance,
} from '../shared/instanceService';
import { loadMemory, saveMemory, shouldSkipBotsForHumanAssignment } from '../shared/memoryService';
import { hasBookingIntent } from '../booking/intent';
import { activateBookingAgentFromChase } from '../booking/handler';
import type { AgentEventType, AgentInstance } from '../shared/types';
import { getDispositionRulesConfig } from '../shared/dispositionRules';
import { handleTelecrmDispositionEvent } from '../shared/telecrmDispositionHandler';
import { shouldChaseTelecrmLead, type TelecrmLeadCandidate } from './telecrmTriggers';

export type ChaseAgentInput = {
  phone: string;
  eventType: AgentEventType;
  customerMessage?: string;
  profileName?: string | null;
  telecrmId?: string | null;
  leadId?: string | null;
  dryRun?: boolean;
  force?: boolean;
  instance?: AgentInstance | null;
};

export type ChaseAgentResult = {
  handled: boolean;
  skippedReason?: string;
  instanceId?: string;
  decision?: unknown;
  route?: 'CHASE_AGENT';
  latencyMs?: number;
};

export async function shouldRouteToChaseAgent(phone: string, message: string): Promise<boolean> {
  const config = await fetchAgentConfig('CHASE');
  if (!config.enabled) return false;
  if (config.rules_json.skip_assigned_chats && (await shouldSkipBotsForHumanAssignment(phone))) return false;
  const active = await getActiveInstance('CHASE', phone);
  return Boolean(active);
}

export async function createChaseInstanceFromTelecrmLead(lead: TelecrmLeadCandidate): Promise<AgentInstance | null> {
  const config = await fetchAgentConfig('CHASE');
  if (!config.enabled) return null;
  if (!shouldChaseTelecrmLead(lead, config)) return null;

  const phone = normalizeAgentPhone(lead.mobile || '');
  if (!phone) return null;

  const existing = await getActiveInstance('CHASE', phone);
  if (existing) return existing;

  const instance = await findOrCreateInstance({
    agentType: 'CHASE',
    phone,
    telecrmId: lead.id,
    metadata: {
      source: 'telecrm_new_lead',
      telecrm_name: lead.name,
      disposition: lead.disposition,
    },
  });

  const memory = await loadMemory(instance.id);
  memory.lead_details = {
    name: lead.name,
    city: lead.city,
    pincode: lead.pincode,
    vehicle_model: lead.vehicle_model,
    service_type: lead.service_type,
  };
  memory.crm_snapshot = { ...lead };
  await saveMemory(memory);

  return instance;
}

export async function processChaseAgentEvent(input: ChaseAgentInput): Promise<ChaseAgentResult> {
  const started = Date.now();
  const phone = normalizePhoneNumber(input.phone);
  const config = await fetchAgentConfig('CHASE');

  if (!config.enabled && !input.dryRun) {
    return { handled: false, skippedReason: 'chase_agent_disabled' };
  }

  let instance = input.instance || (await getActiveInstance('CHASE', phone));

  if (!instance && input.telecrmId && !input.dryRun) {
    instance = await getActiveInstance('CHASE', phone);
  }

  if (!instance && !input.force && !input.dryRun) {
    return { handled: false, skippedReason: 'no_active_chase_instance' };
  }

  if (!instance && input.dryRun) {
    instance = {
      id: 'dry-run',
      agent_type: 'CHASE',
      phone: normalizeAgentPhone(phone),
      lead_id: input.leadId ?? null,
      telecrm_id: input.telecrmId ?? null,
      status: 'ACTIVE',
      goal: null,
      follow_up_count: 0,
      last_action_at: null,
      last_customer_reply_at: null,
      next_wakeup_at: null,
      escalated_at: null,
      escalated_to: null,
      ended_at: null,
      end_reason: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  if (!instance) {
    return { handled: false, skippedReason: 'no_instance' };
  }

  if (input.eventType === 'CUSTOMER_REPLY' && input.customerMessage) {
    if (hasBookingIntent(input.customerMessage)) {
      if (!input.dryRun) {
        await activateBookingAgentFromChase({
          phone,
          leadId: instance.lead_id,
          telecrmId: instance.telecrm_id,
          note: 'Customer showed booking intent during chase',
        });
        const { endInstance } = await import('../shared/instanceService');
        await endInstance(instance.id, 'CONVERTED');
      }
      return {
        handled: true,
        instanceId: instance.id,
        route: 'CHASE_AGENT',
        skippedReason: 'handed_off_to_booking_bot',
        latencyMs: Date.now() - started,
      };
    }
  }

  if (input.eventType === 'SCHEDULED_WAKEUP' && !input.dryRun) {
    await updateInstance(instance.id, { status: 'ACTIVE' });
  }

  const result = await runAgentCycle({
    agentType: 'CHASE',
    phone,
    eventType: input.eventType,
    customerMessage: input.customerMessage,
    instanceId: instance.id,
    instance,
    telecrmId: instance.telecrm_id,
    leadId: instance.lead_id,
    dryRun: input.dryRun,
    mockCrm: input.dryRun
      ? {
          name: 'Rahul',
          vehicle_model: 'Swift',
          disposition: 'Interested',
          city: 'Mumbai',
        }
      : undefined,
  });

  return {
    handled: result.handled,
    skippedReason: result.skippedReason,
    instanceId: instance.id,
    decision: result.decision,
    route: 'CHASE_AGENT',
    latencyMs: result.latencyMs,
  };
}

export async function pollNewTelecrmLeadsForChase(): Promise<{ created: number; errors: string[] }> {
  const config = await fetchAgentConfig('CHASE');
  if (!config.enabled) return { created: 0, errors: [] };

  const { getChaseTriggerConfig } = await import('./telecrmTriggers');
  const tc = getChaseTriggerConfig(config);
  const since = new Date(Date.now() - tc.lookbackHours * 60 * 60 * 1000).toISOString();

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { created: 0, errors: ['No admin client'] };

  const { data: leads, error } = await supabaseAdmin
    .from('telecrm_api')
    .select('id, name, mobile, city, pincode, disposition, service_type, vehicle_model, created_at')
    .gte('created_at', since)
    .not('mobile', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return { created: 0, errors: [error.message] };

  let created = 0;
  const errors: string[] = [];

  for (const lead of leads || []) {
    try {
      const phone = normalizeAgentPhone(lead.mobile);
      if (!phone) continue;

      const { enabled: rulesEnabled } = getDispositionRulesConfig(config);
      if (rulesEnabled && lead.disposition) {
        const existing = await getActiveInstance('CHASE', phone);
        const result = await handleTelecrmDispositionEvent({
          row: lead as TelecrmLeadCandidate,
          eventKind: existing ? 'disposition_change' : 'new_lead',
        });
        if (result.handled) {
          created += 1;
          continue;
        }
        if (result.skippedReason !== 'no_matching_disposition_rule') continue;
      }

      if (!shouldChaseTelecrmLead(lead as TelecrmLeadCandidate, config)) continue;
      const existing = await getActiveInstance('CHASE', phone);
      if (existing) continue;

      const instance = await createChaseInstanceFromTelecrmLead(lead as TelecrmLeadCandidate);
      if (!instance) continue;

      const result = await processChaseAgentEvent({
        phone,
        eventType: 'NEW_LEAD',
        telecrmId: lead.id,
        instance,
      });
      if (result.handled) created += 1;
    } catch (e: any) {
      errors.push(e?.message || 'unknown');
    }
  }

  return { created, errors };
}

export async function processDueChaseWakeups(): Promise<{ processed: number; errors: string[] }> {
  const { fetchDueWakeups, markWakeupDone, markWakeupProcessing, markWakeupFailed } = await import('../shared/schedulerService');
  const wakeups = await fetchDueWakeups(30);
  let processed = 0;
  const errors: string[] = [];

  for (const w of wakeups) {
    try {
      const inst = w.instance as AgentInstance | null;
      if (!inst || inst.agent_type !== 'CHASE') {
        await markWakeupDone(w.id);
        continue;
      }
      await markWakeupProcessing(w.id);
      await throttleCronSends(processed);
      const phone = normalizePhoneNumber(inst.phone);
      await processChaseAgentEvent({
        phone,
        eventType: 'SCHEDULED_WAKEUP',
        instance: inst,
      });
      await markWakeupDone(w.id);
      processed += 1;
    } catch (e: any) {
      await markWakeupFailed(w.id);
      errors.push(e?.message || 'wakeup failed');
    }
  }

  return { processed, errors };
}
