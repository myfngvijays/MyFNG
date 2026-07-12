import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';

export type FlowSessionStatus = 'ACTIVE' | 'COMPLETED' | 'HANDOFF';

export type FlowSessionRecord = {
  id: string;
  phone: string;
  flow_id: string | null;
  version_id: string | null;
  current_node_id: string | null;
  status: FlowSessionStatus;
  variables: Record<string, unknown>;
  last_inbound_at?: string | null;
  updated_at?: string | null;
};

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin unavailable');
  return supabaseAdmin;
}

export async function getFlowSession(phone: string): Promise<FlowSessionRecord | null> {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);
  const { data } = await db
    .from('bot_flow_sessions')
    .select('*')
    .eq('phone', normalized)
    .maybeSingle();
  return (data as FlowSessionRecord) || null;
}

export async function upsertFlowSession(input: {
  phone: string;
  flow_id?: string | null;
  version_id?: string | null;
  current_node_id?: string | null;
  status?: FlowSessionStatus;
  variables?: Record<string, unknown>;
}): Promise<FlowSessionRecord> {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(input.phone);
  const now = new Date().toISOString();
  const existing = await getFlowSession(normalized);
  const payload = {
    phone: normalized,
    flow_id: input.flow_id ?? existing?.flow_id ?? null,
    version_id: input.version_id ?? existing?.version_id ?? null,
    current_node_id: input.current_node_id ?? existing?.current_node_id ?? null,
    status: input.status ?? existing?.status ?? 'ACTIVE',
    variables: { ...(existing?.variables || {}), ...(input.variables || {}) },
    last_inbound_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from('bot_flow_sessions')
    .upsert(payload, { onConflict: 'phone' })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to save flow session');
  return data as FlowSessionRecord;
}

export async function clearFlowSession(phone: string) {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(phone);
  await db.from('bot_flow_sessions').delete().eq('phone', normalized);
}

export async function isFlowSessionHandedOff(phone: string): Promise<boolean> {
  const session = await getFlowSession(phone);
  return session?.status === 'HANDOFF';
}
