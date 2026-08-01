import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type WhatsAppBrainMode = 'AI_FIRST' | 'FLOW_FIRST' | 'HYBRID';

export type WhatsAppBrainToolsConfig = {
  pricing: boolean;
  workshops: boolean;
  service_details: boolean;
  booking: boolean;
};

export type WhatsAppBrainConfig = {
  enabled: boolean;
  mode: WhatsAppBrainMode;
  model: 'gpt-4o' | 'gpt-4o-mini';
  active_flow_id: string | null;
  system_prompt_addon: string;
  fallback_message: string;
  skip_assigned_chats: boolean;
  session_window_hours: number;
  reopen_template_name: string | null;
  reopen_template_language: string;
  reopen_template_params: string[];
  tools: WhatsAppBrainToolsConfig;
};

export const WHATSAPP_BRAIN_SETTING_KEY = 'whatsapp_ai_brain_config';

/** Meta UTILITY template for outbound when the 24h customer-care window is closed. */
export const DEFAULT_BRAIN_REOPEN_TEMPLATE_NAME = 'lead_enquiry_account_update';
export const DEFAULT_BRAIN_REOPEN_TEMPLATE_LANGUAGE = 'en';

export const DEFAULT_WHATSAPP_BRAIN_CONFIG: WhatsAppBrainConfig = {
  enabled: false,
  mode: 'AI_FIRST',
  model: 'gpt-4o',
  active_flow_id: null,
  system_prompt_addon:
    'MISA = MyFNG Instant Service Assistant. Keep replies short. No long intros. List every service plan from pricing tool. Never use ** markdown.',
  fallback_message:
    'Thanks for reaching out to MyFNG! Our team will get back to you shortly. For urgent help, call 9152307030.',
  skip_assigned_chats: true,
  session_window_hours: 24,
  reopen_template_name: DEFAULT_BRAIN_REOPEN_TEMPLATE_NAME,
  reopen_template_language: DEFAULT_BRAIN_REOPEN_TEMPLATE_LANGUAGE,
  reopen_template_params: [],
  tools: {
    pricing: true,
    workshops: true,
    service_details: true,
    booking: true,
  },
};

let cached:
  | {
      value: WhatsAppBrainConfig;
      expiresAt: number;
    }
  | null = null;

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeMode(value: unknown): WhatsAppBrainMode {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'FLOW_FIRST' || raw === 'HYBRID') return raw;
  return 'AI_FIRST';
}

function normalizeModel(value: unknown): 'gpt-4o' | 'gpt-4o-mini' {
  return String(value || '').trim() === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';
}

export function normalizeWhatsAppBrainConfig(partial?: Partial<WhatsAppBrainConfig> | null): WhatsAppBrainConfig {
  const base = DEFAULT_WHATSAPP_BRAIN_CONFIG;
  const tools = partial?.tools || {};
  return {
    enabled: toBool(partial?.enabled, base.enabled),
    mode: normalizeMode(partial?.mode),
    model: normalizeModel(partial?.model),
    active_flow_id: partial?.active_flow_id ? String(partial.active_flow_id).trim() : null,
    system_prompt_addon: String(partial?.system_prompt_addon ?? base.system_prompt_addon).trim().slice(0, 2000),
    fallback_message: String(partial?.fallback_message ?? base.fallback_message).trim().slice(0, 500),
    skip_assigned_chats: toBool(partial?.skip_assigned_chats, base.skip_assigned_chats),
    session_window_hours: Math.min(
      72,
      Math.max(1, Number(partial?.session_window_hours ?? base.session_window_hours) || base.session_window_hours),
    ),
    reopen_template_name: partial?.reopen_template_name
      ? String(partial.reopen_template_name).trim().slice(0, 150)
      : null,
    reopen_template_language: String(partial?.reopen_template_language ?? base.reopen_template_language)
      .trim()
      .slice(0, 10) || 'en',
    reopen_template_params: Array.isArray(partial?.reopen_template_params)
      ? partial!.reopen_template_params.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
      : base.reopen_template_params,
    tools: {
      pricing: toBool(tools.pricing, base.tools.pricing),
      workshops: toBool(tools.workshops, base.tools.workshops),
      service_details: toBool(tools.service_details, base.tools.service_details),
      booking: toBool(tools.booking, base.tools.booking),
    },
  };
}

export function clearWhatsAppBrainConfigCache() {
  cached = null;
}

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error(error || 'Supabase admin client unavailable');
  }
  return supabaseAdmin;
}

export async function fetchWhatsAppBrainConfig(force = false): Promise<WhatsAppBrainConfig> {
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const supabaseAdmin = getAdminDb();
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', WHATSAPP_BRAIN_SETTING_KEY)
    .maybeSingle();

  let parsed: Partial<WhatsAppBrainConfig> | null = null;
  if (data?.setting_value) {
    try {
      parsed = JSON.parse(String(data.setting_value));
    } catch {
      parsed = null;
    }
  }

  const value = normalizeWhatsAppBrainConfig(parsed);
  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export async function saveWhatsAppBrainConfig(
  partial: Partial<WhatsAppBrainConfig>,
  actorId?: string | null,
): Promise<WhatsAppBrainConfig> {
  const current = await fetchWhatsAppBrainConfig(true);
  const next = normalizeWhatsAppBrainConfig({ ...current, ...partial, tools: { ...current.tools, ...partial.tools } });

  const supabaseAdmin = getAdminDb();
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: WHATSAPP_BRAIN_SETTING_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'JSON',
      category: 'whatsapp',
      description: 'WhatsApp AI Brain configuration for inbound auto-replies',
      default_value: JSON.stringify(DEFAULT_WHATSAPP_BRAIN_CONFIG),
      is_editable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );

  if (error) {
    throw new Error(error.message || 'Failed to save WhatsApp brain config');
  }

  clearWhatsAppBrainConfigCache();

  if (next.active_flow_id) {
    await supabaseAdmin.from('bot_flow_events').insert({
      bot_flow_id: next.active_flow_id,
      version_id: null,
      action: 'SET_ACTIVE_BRAIN_FLOW',
      actor_id: actorId || null,
      metadata: { mode: next.mode, enabled: next.enabled },
    });
  }

  return next;
}
