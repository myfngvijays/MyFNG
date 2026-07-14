import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { deriveBookingDraftLabels } from '@/lib/services/bookingIncompleteWhatsApp';
import { throttleCronSends } from '../shared/cronThrottle';
import { fetchAgentConfig } from '../shared/configStore';
import { runAgentCycle } from '../shared/agentRunner';
import {
  endInstance,
  findOrCreateInstance,
  getActiveInstance,
  normalizeAgentPhone,
} from '../shared/instanceService';
import { isChatAssignedToHuman, loadMemory, saveMemory } from '../shared/memoryService';
import { hasBookingIntent } from '../booking/intent';
import { activateBookingAgentFromChase } from '../booking/handler';
import type { AgentEventType, AgentInstance } from '../shared/types';
import {
  getFollowupTriggerConfig,
  isFollowupDueAt,
  type FollowupSourceType,
} from './triggers';

export type FollowupAgentInput = {
  phone: string;
  eventType: AgentEventType;
  customerMessage?: string;
  leadId?: string | null;
  dryRun?: boolean;
  force?: boolean;
  instance?: AgentInstance | null;
  sourceType?: FollowupSourceType;
  sourceId?: string;
};

export type FollowupAgentResult = {
  handled: boolean;
  skippedReason?: string;
  instanceId?: string;
  decision?: unknown;
  route?: 'FOLLOWUP_AGENT';
  latencyMs?: number;
};

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

async function hasFollowupForSource(sourceType: FollowupSourceType, sourceId: string): Promise<boolean> {
  const db = getAdminDb();
  const { data, error } = await db
    .from('whatsapp_agent_instances')
    .select('id')
    .eq('agent_type', 'FOLLOWUP')
    .contains('metadata', { source_type: sourceType, source_id: sourceId })
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
}

async function createFollowupInstance(input: {
  phone: string;
  leadId?: string | null;
  sourceType: FollowupSourceType;
  sourceId: string;
  context: Record<string, unknown>;
}): Promise<AgentInstance> {
  const phone = normalizeAgentPhone(input.phone);
  const instance = await findOrCreateInstance({
    agentType: 'FOLLOWUP',
    phone,
    leadId: input.leadId || null,
    metadata: {
      source_type: input.sourceType,
      source_id: input.sourceId,
      ...input.context,
    },
  });

  const memory = await loadMemory(instance.id);
  memory.lead_details = {
    name: input.context.customer_name || input.context.name || null,
    vehicle_model: input.context.vehicle_model || input.context.car_label || null,
    service_type: input.context.service_type || input.context.service_label || null,
    follow_up_type: input.context.follow_up_type || null,
    reason: input.context.reason || null,
  };
  memory.crm_snapshot = { ...input.context };
  memory.extra = {
    ...memory.extra,
    followup_source: input.sourceType,
    followup_context: input.context,
  };
  await saveMemory(memory);

  return instance;
}

export async function processFollowupAgentEvent(input: FollowupAgentInput): Promise<FollowupAgentResult> {
  const started = Date.now();
  const phone = normalizePhoneNumber(input.phone);
  const config = await fetchAgentConfig('FOLLOWUP');

  if (!config.enabled && !input.dryRun) {
    return { handled: false, skippedReason: 'followup_agent_disabled' };
  }

  if (config.rules_json.skip_assigned_chats && !input.dryRun && (await isChatAssignedToHuman(phone))) {
    return { handled: false, skippedReason: 'chat_assigned_to_human' };
  }

  let instance = input.instance || (await getActiveInstance('FOLLOWUP', phone));

  if (!instance && !input.force && !input.dryRun) {
    return { handled: false, skippedReason: 'no_active_followup_instance' };
  }

  if (!instance && input.dryRun) {
    instance = {
      id: 'dry-run',
      agent_type: 'FOLLOWUP',
      phone: normalizeAgentPhone(phone),
      lead_id: input.leadId ?? null,
      telecrm_id: null,
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
      metadata: {
        source_type: input.sourceType || 'telecaller_follow_up',
        source_id: input.sourceId || 'dry-run',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  if (!instance) {
    return { handled: false, skippedReason: 'no_instance' };
  }

  if (input.eventType === 'CUSTOMER_REPLY' && input.customerMessage && hasBookingIntent(input.customerMessage)) {
    if (!input.dryRun) {
      await activateBookingAgentFromChase({
        phone,
        leadId: instance.lead_id,
        telecrmId: instance.telecrm_id,
        note: 'Customer showed booking intent after follow-up',
      });
      await endInstance(instance.id, 'CONVERTED');
    }
    return {
      handled: true,
      instanceId: instance.id,
      route: 'FOLLOWUP_AGENT',
      skippedReason: 'handed_off_to_booking_bot',
      latencyMs: Date.now() - started,
    };
  }

  const memory = input.dryRun ? null : await loadMemory(instance.id);
  const crmContext = (memory?.crm_snapshot || instance.metadata || {}) as Record<string, unknown>;

  const result = await runAgentCycle({
    agentType: 'FOLLOWUP',
    phone,
    eventType: input.eventType,
    customerMessage: input.customerMessage,
    instanceId: instance.id,
    instance,
    leadId: instance.lead_id,
    dryRun: input.dryRun,
    mockCrm: input.dryRun
      ? {
          customer_name: 'Rahul',
          follow_up_type: 'CALLBACK',
          reason: 'Price confirmation pending',
          vehicle_model: 'Swift',
        }
      : crmContext,
  });

  if (!input.dryRun && result.handled && result.wouldExecute) {
    const action = result.decision?.action;
    if (action === 'SEND_MESSAGE' || action === 'END_CONVERSATION') {
      if (instance.status !== 'ENDED') {
        await endInstance(instance.id, action === 'SEND_MESSAGE' ? 'SENT' : 'COMPLETED');
      }
    }
  }

  return {
    handled: result.handled,
    skippedReason: result.skippedReason,
    instanceId: instance.id,
    decision: result.decision,
    route: 'FOLLOWUP_AGENT',
    latencyMs: result.latencyMs ?? Date.now() - started,
  };
}

async function triggerFollowupFromSource(input: {
  phone: string;
  leadId?: string | null;
  sourceType: FollowupSourceType;
  sourceId: string;
  context: Record<string, unknown>;
}): Promise<boolean> {
  if (await hasFollowupForSource(input.sourceType, input.sourceId)) return false;

  const phone = normalizeAgentPhone(input.phone);
  if (!phone) return false;

  const active = await getActiveInstance('FOLLOWUP', phone);
  if (active) return false;

  const instance = await createFollowupInstance(input);
  const result = await processFollowupAgentEvent({
    phone,
    eventType: 'FOLLOWUP_TRIGGER',
    leadId: input.leadId,
    instance,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  });
  return result.handled;
}

export async function pollTelecallerFollowUps(): Promise<{ sent: number; errors: string[] }> {
  const config = await fetchAgentConfig('FOLLOWUP');
  if (!config.enabled) return { sent: 0, errors: [] };

  const tc = getFollowupTriggerConfig(config);
  if (!tc.telecallerFollowUpEnabled) return { sent: 0, errors: [] };

  const db = getAdminDb();
  const { data, error } = await db
    .from('telecaller_follow_ups')
    .select(
      'id, lead_id, follow_up_type, scheduled_time, reason, context_notes, status, lead:service_leads(customer_phone, customer_name, vehicle_make, vehicle_model, vehicle_number, service_type)',
    )
    .eq('status', 'PENDING')
    .lte('scheduled_time', new Date().toISOString())
    .order('scheduled_time', { ascending: true })
    .limit(tc.pollLimit);

  if (error) return { sent: 0, errors: [error.message] };

  let sent = 0;
  const errors: string[] = [];

  for (const row of data || []) {
    try {
      if (!isFollowupDueAt(String(row.scheduled_time), tc.telecallerOffsetMinutes)) continue;

      const lead = (row as { lead?: Record<string, unknown> }).lead || {};
      const phone = String(lead.customer_phone || '').trim();
      if (!phone) continue;

      const ok = await triggerFollowupFromSource({
        phone,
        leadId: String(row.lead_id),
        sourceType: 'telecaller_follow_up',
        sourceId: String(row.id),
        context: {
          customer_name: lead.customer_name,
          vehicle_model: [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' '),
          vehicle_number: lead.vehicle_number,
          service_type: lead.service_type,
          follow_up_type: row.follow_up_type,
          reason: row.reason,
          context_notes: row.context_notes,
          scheduled_time: row.scheduled_time,
        },
      });
      if (ok) sent += 1;
    } catch (e: any) {
      errors.push(e?.message || 'telecaller follow-up failed');
    }
  }

  return { sent, errors };
}

export async function pollIncompleteBookings(): Promise<{ sent: number; errors: string[] }> {
  const config = await fetchAgentConfig('FOLLOWUP');
  if (!config.enabled) return { sent: 0, errors: [] };

  const tc = getFollowupTriggerConfig(config);
  if (!tc.incompleteBookingEnabled) return { sent: 0, errors: [] };

  const cutoff = new Date(Date.now() - tc.incompleteBookingDelayHours * 60 * 60 * 1000).toISOString();
  const db = getAdminDb();
  const { data, error } = await db
    .from('booking_drafts')
    .select(
      'id, customer_id, customer_phone, customer_name, car_label, service_label, draft_payload, last_activity_at',
    )
    .eq('status', 'ACTIVE')
    .lte('last_activity_at', cutoff)
    .not('customer_phone', 'is', null)
    .order('last_activity_at', { ascending: true })
    .limit(tc.pollLimit);

  if (error) return { sent: 0, errors: [error.message] };

  let sent = 0;
  const errors: string[] = [];

  for (const row of data || []) {
    try {
      const phone = String(row.customer_phone || '').trim();
      if (!phone) continue;

      const payload = (row.draft_payload || {}) as Record<string, unknown>;
      const labels = deriveBookingDraftLabels(payload);

      const ok = await triggerFollowupFromSource({
        phone,
        sourceType: 'incomplete_booking',
        sourceId: String(row.id),
        context: {
          customer_name: row.customer_name || payload.customerName || 'Customer',
          car_label: row.car_label || labels.carLabel,
          service_label: row.service_label || labels.serviceLabel,
          booking_draft_id: row.id,
          last_activity_at: row.last_activity_at,
        },
      });
      if (ok) sent += 1;
    } catch (e: any) {
      errors.push(e?.message || 'incomplete booking follow-up failed');
    }
  }

  return { sent, errors };
}

export async function pollServiceDueReminders(): Promise<{ sent: number; errors: string[] }> {
  const config = await fetchAgentConfig('FOLLOWUP');
  if (!config.enabled) return { sent: 0, errors: [] };

  const tc = getFollowupTriggerConfig(config);
  if (!tc.serviceDueReminderEnabled) return { sent: 0, errors: [] };

  const dueBefore = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const db = getAdminDb();
  const { data, error } = await db
    .from('service_leads')
    .select(
      'id, customer_id, customer_phone, customer_name, vehicle_make, vehicle_model, vehicle_number, completed_at, service_type, status',
    )
    .in('status', ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED'])
    .not('customer_phone', 'is', null)
    .not('completed_at', 'is', null)
    .lte('completed_at', dueBefore)
    .order('completed_at', { ascending: false })
    .limit(tc.pollLimit * 2);

  if (error) return { sent: 0, errors: [error.message] };

  const latestByKey = new Map<string, (typeof data)[number]>();
  for (const row of data || []) {
    const phone = String(row.customer_phone || '').trim();
    const reg = String(row.vehicle_number || 'NA').trim().toUpperCase();
    if (!phone) continue;
    const key = `${phone}:${reg}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }

  let sent = 0;
  const errors: string[] = [];

  for (const row of latestByKey.values()) {
    try {
      const phone = String(row.customer_phone || '').trim();
      if (!phone) continue;

      const ok = await triggerFollowupFromSource({
        phone,
        leadId: String(row.id),
        sourceType: 'service_due_reminder',
        sourceId: String(row.id),
        context: {
          customer_name: row.customer_name,
          vehicle_model: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' '),
          vehicle_number: row.vehicle_number,
          last_service_at: row.completed_at,
          service_type: row.service_type,
        },
      });
      if (ok) sent += 1;
      if (sent >= tc.pollLimit) break;
    } catch (e: any) {
      errors.push(e?.message || 'service due follow-up failed');
    }
  }

  return { sent, errors };
}

export async function pollCseCallbacks(): Promise<{ sent: number; errors: string[] }> {
  const config = await fetchAgentConfig('FOLLOWUP');
  if (!config.enabled) return { sent: 0, errors: [] };

  const tc = getFollowupTriggerConfig(config);
  if (!tc.cseCallbackEnabled) return { sent: 0, errors: [] };

  const db = getAdminDb();
  const { data, error } = await db
    .from('service_leads')
    .select(
      'id, customer_phone, customer_name, vehicle_number, vehicle_make, vehicle_model, delivered_at, cse_followup_due_at, cse_followups(id, completed_at)',
    )
    .eq('cse_followup_due', true)
    .in('status', ['DELIVERED_TO_CUSTOMER', 'DELIVERED'])
    .not('customer_phone', 'is', null)
    .lte('cse_followup_due_at', new Date().toISOString())
    .order('cse_followup_due_at', { ascending: true })
    .limit(tc.pollLimit);

  if (error) return { sent: 0, errors: [error.message] };

  let sent = 0;
  const errors: string[] = [];

  for (const row of data || []) {
    try {
      const followups = (row as { cse_followups?: Array<{ completed_at?: string | null }> }).cse_followups || [];
      if (followups.some((f) => f.completed_at)) continue;

      const phone = String(row.customer_phone || '').trim();
      if (!phone) continue;

      const ok = await triggerFollowupFromSource({
        phone,
        leadId: String(row.id),
        sourceType: 'cse_callback',
        sourceId: String(row.id),
        context: {
          customer_name: row.customer_name,
          vehicle_model: [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' '),
          vehicle_number: row.vehicle_number,
          delivered_at: row.delivered_at,
          follow_up_type: 'CSE_POST_DELIVERY',
        },
      });
      if (ok) sent += 1;
    } catch (e: any) {
      errors.push(e?.message || 'cse callback follow-up failed');
    }
  }

  return { sent, errors };
}

export async function pollAllFollowupTriggers(): Promise<{
  telecaller: { sent: number; errors: string[] };
  incompleteBooking: { sent: number; errors: string[] };
  serviceDue: { sent: number; errors: string[] };
  cseCallback: { sent: number; errors: string[] };
}> {
  const [telecaller, incompleteBooking, serviceDue, cseCallback] = await Promise.all([
    pollTelecallerFollowUps(),
    pollIncompleteBookings(),
    pollServiceDueReminders(),
    pollCseCallbacks(),
  ]);
  return { telecaller, incompleteBooking, serviceDue, cseCallback };
}

export async function processDueFollowupWakeups(): Promise<{ processed: number; errors: string[] }> {
  const { fetchDueWakeups, markWakeupDone, markWakeupProcessing, markWakeupFailed } = await import('../shared/schedulerService');
  const wakeups = await fetchDueWakeups(30);
  let processed = 0;
  const errors: string[] = [];

  for (const w of wakeups) {
    try {
      const inst = w.instance as AgentInstance | null;
      if (!inst || inst.agent_type !== 'FOLLOWUP') continue;

      await markWakeupProcessing(w.id);
      await throttleCronSends(processed);
      const phone = normalizePhoneNumber(inst.phone);
      await processFollowupAgentEvent({
        phone,
        eventType: 'SCHEDULED_WAKEUP',
        instance: inst,
      });
      await markWakeupDone(w.id);
      processed += 1;
    } catch (e: any) {
      await markWakeupFailed(w.id);
      errors.push(e?.message || 'followup wakeup failed');
    }
  }

  return { processed, errors };
}
