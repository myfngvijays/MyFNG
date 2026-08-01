import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import type { AgentInstance, AgentStatus, AgentType } from './types';

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

export function normalizeAgentPhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export async function getInstanceById(instanceId: string): Promise<AgentInstance | null> {
  const db = getAdminDb();
  const { data, error } = await db
    .from('whatsapp_agent_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }
  return (data as AgentInstance) || null;
}

export async function getActiveInstancesByPhone(
  phone: string,
  agentTypes?: AgentType[],
): Promise<AgentInstance[]> {
  const db = getAdminDb();
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) return [];

  let query = db
    .from('whatsapp_agent_instances')
    .select('*')
    .eq('phone', normalized)
    .in('status', ['ACTIVE', 'WAITING']);

  if (agentTypes?.length) {
    query = query.in('agent_type', agentTypes);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return (data as AgentInstance[]) || [];
}

export async function getActiveInstance(
  agentType: AgentType,
  phone: string,
): Promise<AgentInstance | null> {
  const db = getAdminDb();
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) return null;

  const { data, error } = await db
    .from('whatsapp_agent_instances')
    .select('*')
    .eq('agent_type', agentType)
    .eq('phone', normalized)
    .in('status', ['ACTIVE', 'WAITING'])
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }
  return (data as AgentInstance) || null;
}

export async function findOrCreateInstance(input: {
  agentType: AgentType;
  phone: string;
  leadId?: string | null;
  telecrmId?: string | null;
  goal?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AgentInstance> {
  const existing = await getActiveInstance(input.agentType, input.phone);
  if (existing) return existing;

  const db = getAdminDb();
  const normalized = normalizeAgentPhone(input.phone);
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('whatsapp_agent_instances')
    .insert({
      agent_type: input.agentType,
      phone: normalized,
      lead_id: input.leadId || null,
      telecrm_id: input.telecrmId || null,
      status: 'ACTIVE',
      goal: input.goal || null,
      follow_up_count: 0,
      metadata: input.metadata || {},
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message || 'Failed to create agent instance');

  await db.from('whatsapp_agent_memory').upsert(
    {
      instance_id: data.id,
      lead_details: {},
      conversation_summary: '',
      buying_intent: 'NONE',
      sentiment: 'NEUTRAL',
      customer_preferences: {},
      sent_messages: [],
      crm_snapshot: {},
      extra: {},
      updated_at: now,
    },
    { onConflict: 'instance_id' },
  );

  return data as AgentInstance;
}

export async function updateInstance(
  instanceId: string,
  patch: Partial<{
    status: AgentStatus;
    follow_up_count: number;
    last_action_at: string;
    last_customer_reply_at: string;
    next_wakeup_at: string | null;
    ended_at: string | null;
    end_reason: string | null;
    lead_id: string | null;
    escalated_at: string | null;
    telecrm_id: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  const db = getAdminDb();
  const { error } = await db
    .from('whatsapp_agent_instances')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', instanceId);

  if (error) throw new Error(error.message || 'Failed to update instance');
}

export async function endInstance(
  instanceId: string,
  endReason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateInstance(instanceId, {
    status: 'ENDED',
    ended_at: now,
    end_reason: endReason,
    next_wakeup_at: null,
  });

  const db = getAdminDb();
  await db
    .from('whatsapp_agent_scheduled_wakeups')
    .update({ status: 'CANCELLED' })
    .eq('instance_id', instanceId)
    .eq('status', 'PENDING');
}

export async function endStaleAgentInstances(phone: string, maxIdleHours = 72): Promise<number> {
  const instances = await getActiveInstancesByPhone(phone);
  if (!instances.length) return 0;

  const cutoffMs = Date.now() - maxIdleHours * 60 * 60 * 1000;
  let ended = 0;

  for (const instance of instances) {
    const lastTouch = String(
      instance.last_customer_reply_at || instance.last_action_at || instance.created_at || '',
    ).trim();
    const lastMs = Date.parse(lastTouch);
    if (!Number.isFinite(lastMs) || lastMs >= cutoffMs) continue;
    await endInstance(instance.id, 'MANUAL');
    ended += 1;
  }

  return ended;
}
