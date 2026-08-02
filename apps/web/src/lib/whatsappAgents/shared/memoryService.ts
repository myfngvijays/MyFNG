import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { emptyMemory } from './configStore';
import type { AgentMemory, AgentType, BuyingIntent, Sentiment } from './types';

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

export async function loadMemory(instanceId: string): Promise<AgentMemory> {
  const db = getAdminDb();
  const { data, error } = await db
    .from('whatsapp_agent_memory')
    .select('*')
    .eq('instance_id', instanceId)
    .maybeSingle();

  if (error && error.code !== '42P01') {
    throw new Error(error.message || 'Failed to load memory');
  }

  if (!data) return emptyMemory(instanceId);

  return {
    instance_id: instanceId,
    lead_details: (data.lead_details as Record<string, unknown>) || {},
    conversation_summary: String(data.conversation_summary || ''),
    buying_intent: (data.buying_intent as BuyingIntent) || 'NONE',
    sentiment: (data.sentiment as Sentiment) || 'NEUTRAL',
    customer_preferences: (data.customer_preferences as Record<string, unknown>) || {},
    sent_messages: Array.isArray(data.sent_messages) ? data.sent_messages : [],
    crm_snapshot: (data.crm_snapshot as Record<string, unknown>) || {},
    extra: (data.extra as Record<string, unknown>) || {},
    updated_at: data.updated_at || new Date().toISOString(),
  };
}

export async function saveMemory(memory: AgentMemory): Promise<void> {
  const db = getAdminDb();
  const { error } = await db.from('whatsapp_agent_memory').upsert(
    {
      instance_id: memory.instance_id,
      lead_details: memory.lead_details,
      conversation_summary: memory.conversation_summary,
      buying_intent: memory.buying_intent,
      sentiment: memory.sentiment,
      customer_preferences: memory.customer_preferences,
      sent_messages: memory.sent_messages,
      crm_snapshot: memory.crm_snapshot,
      extra: memory.extra,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'instance_id' },
  );

  if (error) throw new Error(error.message || 'Failed to save memory');
}

export async function loadConversationForPhone(phone: string, limit = 20): Promise<Array<{ direction: string; body: string; at: string }>> {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);

  const { data } = await db
    .from('whatsapp_messages')
    .select('direction, text_body, created_at, sender_phone, recipient_phone')
    .or(`sender_phone.eq.${normalized},recipient_phone.eq.${normalized}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((row: any) => ({
    direction: String(row.direction || 'unknown'),
    body: String(row.text_body || ''),
    at: String(row.created_at || ''),
  }));
}

export async function loadRecentOutboundTextsForPhone(phone: string, limit = 8): Promise<string[]> {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);

  const { data } = await db
    .from('whatsapp_messages')
    .select('text_body, created_at')
    .or(`sender_phone.eq.${normalized},recipient_phone.eq.${normalized}`)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(limit);

  const seen = new Set<string>();
  const messages: string[] = [];
  for (const row of data || []) {
    const text = String((row as { text_body?: string }).text_body || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    messages.push(text);
  }
  return messages;
}

export async function loadCrmSnapshot(telecrmId?: string | null): Promise<Record<string, unknown>> {
  if (!telecrmId) return {};
  const db = getAdminDb();
  const { data } = await db
    .from('telecrm_api')
    .select('name, mobile, city, pincode, disposition, service_type, vehicle_model, customer_quoted_amount')
    .eq('id', telecrmId)
    .maybeSingle();
  return (data as Record<string, unknown>) || {};
}

export async function countDailyOutboundMessages(instanceId: string): Promise<number> {
  const db = getAdminDb();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count } = await db
    .from('whatsapp_agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .eq('validated_action', 'SEND_MESSAGE')
    .eq('execution_status', 'EXECUTED')
    .gte('created_at', since.toISOString());

  return count ?? 0;
}

export async function isChatAssignedToHuman(phone: string): Promise<boolean> {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);
  const last10 = normalized.slice(-10);
  const { data } = await db
    .from('whatsapp_chat_assignments')
    .select('assigned_to_ids, phone')
    .or(`phone.eq.${normalized},phone.eq.${last10},phone.eq.91${last10}`)
    .limit(1)
    .maybeSingle();

  const ids = Array.isArray(data?.assigned_to_ids) ? data.assigned_to_ids : [];
  return ids.filter(Boolean).length > 0;
}

function isManualHumanWhatsAppOutbound(row: {
  message_type?: string | null;
  meta?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}): boolean {
  const meta = (row.meta || {}) as Record<string, unknown>;
  const payload = (row.payload || {}) as Record<string, unknown>;
  if (meta.brain_auto_reply || meta.agent_auto_reply) return false;
  if (meta.source === 'whatsapp_automation' || meta.trigger_key) return false;
  if (payload.source === 'whatsapp_automation') return false;
  if (String(row.message_type || '').toUpperCase() === 'TEMPLATE') return false;
  return true;
}

/**
 * Only pause bots when a human is assigned AND recently sent a manual (non-bot) WhatsApp message.
 * Assignment alone (e.g. auto-map from admin panel) should not permanently silence MISA.
 */
export async function shouldSkipBotsForHumanAssignment(phone: string): Promise<boolean> {
  if (!(await isChatAssignedToHuman(phone))) return false;

  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);
  const last10 = normalized.slice(-10);
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: outbound } = await db
    .from('whatsapp_messages')
    .select('message_type, meta, payload')
    .eq('direction', 'OUTBOUND')
    .or(`recipient_phone.eq.${normalized},recipient_phone.eq.${last10},recipient_phone.eq.91${last10}`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  return (outbound || []).some((row) => isManualHumanWhatsAppOutbound(row as any));
}

export type MemoryContextBundle = {
  memory: AgentMemory;
  conversation: Array<{ direction: string; body: string; at: string }>;
  crm: Record<string, unknown>;
};

export async function loadMemoryContext(
  instanceId: string,
  phone: string,
  telecrmId?: string | null,
): Promise<MemoryContextBundle> {
  const [memory, conversation, crm] = await Promise.all([
    loadMemory(instanceId),
    loadConversationForPhone(phone),
    loadCrmSnapshot(telecrmId),
  ]);
  return { memory, conversation, crm };
}
