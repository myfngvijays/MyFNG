import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { defaultAgentConfig, DEFAULT_AGENT_RULES, DEFAULT_AGENT_TOOLS, DEFAULT_TELECRM_SYNC } from './defaults';
import { getResolvedWhatsAppAgentsCredentials } from './envConfigStore';
import type { AgentConfig, AgentMemory, AgentRuntime, AgentType } from './types';

const configCache = new Map<AgentType, { value: AgentConfig; expiresAt: number }>();

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const n = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(n)) return true;
  if (['false', '0', 'no', 'off'].includes(n)) return false;
  return fallback;
}

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

export function normalizeAgentConfig(
  agentType: AgentType,
  partial?: Partial<AgentConfig> | null,
): AgentConfig {
  const base = defaultAgentConfig(agentType);
  const rules = { ...DEFAULT_AGENT_RULES, ...(partial?.rules_json || {}) };
  const tools = { ...DEFAULT_AGENT_TOOLS, ...(partial?.tools_json || {}) };
  const telecrm = { ...DEFAULT_TELECRM_SYNC, ...(partial?.telecrm_sync_json || {}) };

  return {
    agent_type: agentType,
    enabled: toBool(partial?.enabled, base.enabled),
    model: partial?.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
    goal_prompt: String(partial?.goal_prompt ?? base.goal_prompt).trim().slice(0, 4000),
    system_prompt_addon: String(partial?.system_prompt_addon ?? base.system_prompt_addon).trim().slice(0, 2000),
    fallback_message: String(partial?.fallback_message ?? base.fallback_message).trim().slice(0, 500),
    rules_json: {
      ...rules,
      max_follow_ups: Math.min(20, Math.max(1, Number(rules.max_follow_ups) || DEFAULT_AGENT_RULES.max_follow_ups)),
      min_wait_hours: Math.min(168, Math.max(1, Number(rules.min_wait_hours) || DEFAULT_AGENT_RULES.min_wait_hours)),
      max_daily_messages: Math.min(10, Math.max(1, Number(rules.max_daily_messages) || DEFAULT_AGENT_RULES.max_daily_messages)),
      confidence_threshold: Math.min(1, Math.max(0, Number(rules.confidence_threshold) || DEFAULT_AGENT_RULES.confidence_threshold)),
      allowed_languages: Array.isArray(rules.allowed_languages)
        ? rules.allowed_languages.map(String).filter(Boolean)
        : DEFAULT_AGENT_RULES.allowed_languages,
      blocked_words: Array.isArray(rules.blocked_words)
        ? rules.blocked_words.map(String).filter(Boolean)
        : DEFAULT_AGENT_RULES.blocked_words,
      escalation_keywords: Array.isArray(rules.escalation_keywords)
        ? rules.escalation_keywords.map(String).filter(Boolean)
        : DEFAULT_AGENT_RULES.escalation_keywords,
    },
    triggers_json:
      partial?.triggers_json && typeof partial.triggers_json === 'object'
        ? { ...base.triggers_json, ...partial.triggers_json }
        : base.triggers_json,
    tools_json: {
      pricing: toBool(tools.pricing, base.tools_json.pricing),
      workshops: toBool(tools.workshops, base.tools_json.workshops),
      service_details: toBool(tools.service_details, base.tools_json.service_details),
      booking: toBool(tools.booking, base.tools_json.booking),
    },
    telecrm_sync_json: telecrm,
    updated_by: partial?.updated_by ?? null,
    created_at: partial?.created_at,
    updated_at: partial?.updated_at,
  };
}

export function clearAgentConfigCache(agentType?: AgentType) {
  if (agentType) configCache.delete(agentType);
  else configCache.clear();
}

export async function fetchAgentConfig(agentType: AgentType, force = false): Promise<AgentConfig> {
  const cached = configCache.get(agentType);
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const db = getAdminDb();
  const { data, error } = await db
    .from('whatsapp_agent_configs')
    .select('*')
    .eq('agent_type', agentType)
    .maybeSingle();

  if (error) {
    // Table may not exist yet before migration — return defaults
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return defaultAgentConfig(agentType);
    }
    throw new Error(error.message || 'Failed to fetch agent config');
  }

  const value = normalizeAgentConfig(agentType, data || undefined);
  configCache.set(agentType, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

export async function saveAgentConfig(
  agentType: AgentType,
  partial: Partial<AgentConfig>,
  actorId?: string | null,
): Promise<AgentConfig> {
  const current = await fetchAgentConfig(agentType, true);
  const next = normalizeAgentConfig(agentType, {
    ...current,
    ...partial,
    rules_json: { ...current.rules_json, ...(partial.rules_json || {}) },
    triggers_json: { ...current.triggers_json, ...(partial.triggers_json || {}) },
    tools_json: { ...current.tools_json, ...(partial.tools_json || {}) },
    telecrm_sync_json: { ...current.telecrm_sync_json, ...(partial.telecrm_sync_json || {}) },
    updated_by: actorId || null,
  });

  const db = getAdminDb();
  const { error } = await db.from('whatsapp_agent_configs').upsert(
    {
      agent_type: agentType,
      enabled: next.enabled,
      model: next.model,
      goal_prompt: next.goal_prompt,
      system_prompt_addon: next.system_prompt_addon,
      fallback_message: next.fallback_message,
      rules_json: next.rules_json,
      triggers_json: next.triggers_json,
      tools_json: next.tools_json,
      telecrm_sync_json: next.telecrm_sync_json,
      updated_by: actorId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agent_type' },
  );

  if (error) throw new Error(error.message || 'Failed to save agent config');
  clearAgentConfigCache(agentType);
  return next;
}

export async function fetchAgentRuntime(agentType: AgentType): Promise<AgentRuntime> {
  const db = getAdminDb();
  let activeInstances = 0;

  try {
    const { count } = await db
      .from('whatsapp_agent_instances')
      .select('id', { count: 'exact', head: true })
      .eq('agent_type', agentType)
      .in('status', ['ACTIVE', 'WAITING']);
    activeInstances = count ?? 0;
  } catch {
    activeInstances = 0;
  }

  const creds = await getResolvedWhatsAppAgentsCredentials();

  return {
    openai_configured: Boolean(creds.openai_api_key),
    whatsapp_configured: Boolean(creds.whatsapp_access_token && creds.whatsapp_phone_number_id),
    active_instances: activeInstances,
  };
}

export async function ensureAgentConfigsSeeded(): Promise<void> {
  const db = getAdminDb();
  for (const agentType of ['BOOKING', 'FOLLOWUP', 'CHASE'] as AgentType[]) {
    const defaults = defaultAgentConfig(agentType);
    await db.from('whatsapp_agent_configs').upsert(
      {
        agent_type: agentType,
        enabled: defaults.enabled,
        model: defaults.model,
        goal_prompt: defaults.goal_prompt,
        system_prompt_addon: defaults.system_prompt_addon,
        fallback_message: defaults.fallback_message,
        rules_json: defaults.rules_json,
        triggers_json: defaults.triggers_json,
        tools_json: defaults.tools_json,
        telecrm_sync_json: defaults.telecrm_sync_json,
      },
      { onConflict: 'agent_type', ignoreDuplicates: true },
    );
  }
}

export function emptyMemory(instanceId: string): AgentMemory {
  return {
    instance_id: instanceId,
    lead_details: {},
    conversation_summary: '',
    buying_intent: 'NONE',
    sentiment: 'NEUTRAL',
    customer_preferences: {},
    sent_messages: [],
    crm_snapshot: {},
    extra: {},
    updated_at: new Date().toISOString(),
  };
}
