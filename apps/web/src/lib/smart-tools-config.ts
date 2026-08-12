import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  defaultSmartToolPlacements,
  legacyPlacementsFromFlags,
  normalizeAllowedPhones,
  normalizeAllowedPlanIds,
  mergeSmartToolPlacements,
  parseSmartToolPlacements,
  syncLegacyVisibilityFlags,
  type SmartToolPlacements,
} from '@/lib/smart-tools-placements';

function freshDefaultPlacements(): SmartToolPlacements {
  return defaultSmartToolPlacements();
}

export type SmartToolRow = {
  id?: string;
  tool_id: string;
  title: string;
  subtitle?: string | null;
  tool_type: 'native' | 'webview';
  screen_name?: string | null;
  default_web_url?: string | null;
  enabled: boolean;
  membership_only: boolean;
  allowed_membership_plan_ids: string[];
  /** Logged-in customers on this list can see the tool even without membership. */
  allowed_phones: string[];
  requires_login: boolean;
  show_on_home: boolean;
  show_on_search: boolean;
  placements: SmartToolPlacements;
  display_order: number;
  title_override?: string | null;
  web_url_override?: string | null;
};

export type SmartToolsSectionConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
};

export type SmartToolsHandlerConfig = {
  section: SmartToolsSectionConfig;
  tools: SmartToolRow[];
};

export const DEFAULT_SMART_TOOLS: SmartToolRow[] = [
  { tool_id: 'car_health', title: 'Smart Health Checkup', subtitle: 'AI vehicle health score', tool_type: 'native', screen_name: 'CarHealthCheck', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 1 },
  { tool_id: 'fuel_calculator', title: 'Fuel Cost Calculator', subtitle: 'Trip fuel estimate', tool_type: 'native', screen_name: 'FuelCostCalculator', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 2 },
  { tool_id: 'price_compare', title: 'Compare Service Cost', subtitle: 'Workshop price comparison', tool_type: 'native', screen_name: 'AuthorisedPricing', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 3 },
  { tool_id: 'car_loan', title: 'Loan Against Car', subtitle: 'Instant loan options', tool_type: 'webview', screen_name: 'SmartToolWeb', default_web_url: 'https://myfng.in/car-loan?embed=1', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 4 },
  { tool_id: 'resale_value', title: 'Car Resale Value', subtitle: 'Market resale estimate', tool_type: 'native', screen_name: 'ResaleValue', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 5 },
  { tool_id: 'car_quiz', title: 'Car Quiz', subtitle: 'Daily car trivia', tool_type: 'native', screen_name: 'CarQuizGame', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 6 },
  { tool_id: 'parking_finder', title: 'Nearby Parking', subtitle: 'Find parking near you', tool_type: 'webview', screen_name: 'SmartToolWeb', default_web_url: 'https://www.google.com/maps/search/parking+near+me', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 7 },
  { tool_id: 'parts_price', title: 'Check Parts Price', subtitle: 'OEM parts price check', tool_type: 'native', screen_name: 'CarPartsPrice', enabled: true, membership_only: false, allowed_membership_plan_ids: [], allowed_phones: [], requires_login: false, show_on_home: true, show_on_search: true, placements: freshDefaultPlacements(), display_order: 8 },
];

export const DEFAULT_SMART_TOOLS_HANDLER: SmartToolsHandlerConfig = {
  section: {
    enabled: true,
    title: 'Smart Tools',
    subtitle: 'Smart car utilities for health, pricing, fuel & more',
  },
  tools: DEFAULT_SMART_TOOLS,
};

const SECTION_KEYS = {
  enabled: 'smart_tools_section_enabled',
  title: 'smart_tools_section_title',
  subtitle: 'smart_tools_section_subtitle',
} as const;

const TABLE = 'smart_tools';

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === '0' || text === 'no') return false;
  return fallback;
}

function toText(value: unknown, fallback = '', max = 200): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function normalizeToolRow(raw: Partial<SmartToolRow>, fallback?: SmartToolRow): SmartToolRow {
  const base = fallback || DEFAULT_SMART_TOOLS.find((t) => t.tool_id === raw.tool_id) || DEFAULT_SMART_TOOLS[0];
  let placements = parseSmartToolPlacements(raw.placements);
  const hasPlacementData = raw.placements && typeof raw.placements === 'object' && Object.keys(raw.placements).length > 0;
  if (!hasPlacementData && (raw.show_on_home !== undefined || raw.show_on_search !== undefined)) {
    placements = legacyPlacementsFromFlags(
      raw.show_on_home !== undefined ? Boolean(raw.show_on_home) : base.show_on_home,
      raw.show_on_search !== undefined ? Boolean(raw.show_on_search) : base.show_on_search,
    );
  }
  placements = mergeSmartToolPlacements(placements, base.placements);
  const legacyFlags = syncLegacyVisibilityFlags(placements);
  const allowedPlanIds = normalizeAllowedPlanIds(raw.allowed_membership_plan_ids ?? base.allowed_membership_plan_ids);
  const allowedPhones = normalizeAllowedPhones(
    raw.allowed_phones !== undefined ? raw.allowed_phones : base.allowed_phones,
  );
  const membershipOnly =
    allowedPlanIds.length > 0
      ? true
      : raw.membership_only !== undefined
        ? Boolean(raw.membership_only)
        : base.membership_only;

  return {
    id: raw.id,
    tool_id: toText(raw.tool_id, base.tool_id, 64),
    title: toText(raw.title, base.title, 120),
    subtitle: toText(raw.subtitle, base.subtitle || '', 160) || null,
    tool_type: raw.tool_type === 'webview' ? 'webview' : 'native',
    screen_name: toText(raw.screen_name, base.screen_name || '', 80) || null,
    default_web_url: toText(raw.default_web_url, base.default_web_url || '', 500) || null,
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    membership_only: membershipOnly,
    allowed_membership_plan_ids: allowedPlanIds,
    allowed_phones: allowedPhones,
    requires_login: raw.requires_login !== undefined ? Boolean(raw.requires_login) : base.requires_login,
    show_on_home: legacyFlags.show_on_home,
    show_on_search: legacyFlags.show_on_search,
    placements,
    display_order: Number.isFinite(Number(raw.display_order)) ? Math.max(0, Math.floor(Number(raw.display_order))) : base.display_order,
    title_override: toText(raw.title_override, '', 120) || null,
    web_url_override: toText(raw.web_url_override, '', 500) || null,
  };
}

export function normalizeSmartToolsHandlerConfig(input?: Partial<SmartToolsHandlerConfig> | null): SmartToolsHandlerConfig {
  const sectionInput = input?.section || {};
  const toolsInput = Array.isArray(input?.tools) ? input.tools : [];
  const byId = new Map(DEFAULT_SMART_TOOLS.map((tool) => [tool.tool_id, tool]));

  const tools = (toolsInput.length ? toolsInput : DEFAULT_SMART_TOOLS)
    .map((tool) => normalizeToolRow(tool, byId.get(String(tool.tool_id || ''))))
    .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));

  return {
    section: {
      enabled: sectionInput.enabled !== undefined ? Boolean(sectionInput.enabled) : DEFAULT_SMART_TOOLS_HANDLER.section.enabled,
      title: toText(sectionInput.title, DEFAULT_SMART_TOOLS_HANDLER.section.title, 80),
      subtitle: toText(sectionInput.subtitle, DEFAULT_SMART_TOOLS_HANDLER.section.subtitle, 160),
    },
    tools,
  };
}

function readSectionFromMap(map: Map<string, string>): SmartToolsSectionConfig {
  return {
    enabled: toBool(map.get(SECTION_KEYS.enabled), true),
    title: toText(map.get(SECTION_KEYS.title), DEFAULT_SMART_TOOLS_HANDLER.section.title, 80),
    subtitle: toText(map.get(SECTION_KEYS.subtitle), DEFAULT_SMART_TOOLS_HANDLER.section.subtitle, 160),
  };
}

async function upsertSetting(supabaseAdmin: any, key: string, value: string, updatedBy?: string | null) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: key.endsWith('_enabled') ? 'BOOLEAN' : 'STRING',
      category: 'APP',
      description: 'Smart Tools Handler mobile config',
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message || `Could not save ${key}`);
}

export function migrationHintForSmartToolsError(message: string): string | null {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('smart_tools') && lower.includes('does not exist')) {
    return 'Run database migration 235_smart_tools_handler.sql in Supabase SQL Editor.';
  }
  if (lower.includes('allowed_membership_plan_ids') && lower.includes('does not exist')) {
    return 'Run database migration 236_smart_tools_placements_membership.sql in Supabase SQL Editor.';
  }
  if (lower.includes('allowed_phones') && lower.includes('does not exist')) {
    return 'Run database migration 306_smart_tools_allowed_phones.sql in Supabase SQL Editor.';
  }
  if (lower.includes('get_public_smart_tools_config') && lower.includes('does not exist')) {
    return 'Run database migration 235_smart_tools_handler.sql in Supabase SQL Editor.';
  }
  return null;
}

export async function getSmartToolsHandlerConfig(supabaseAdmin?: any): Promise<SmartToolsHandlerConfig> {
  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) return DEFAULT_SMART_TOOLS_HANDLER;

  const [{ data: tools, error: toolsError }, { data: settings }] = await Promise.all([
    admin.from(TABLE).select('*').order('display_order', { ascending: true }),
    admin.from('system_settings').select('setting_key, setting_value').in('setting_key', Object.values(SECTION_KEYS)),
  ]);

  if (toolsError) {
    const hint = migrationHintForSmartToolsError(toolsError.message);
    if (hint) return DEFAULT_SMART_TOOLS_HANDLER;
    throw new Error(toolsError.message || 'Failed to load smart tools');
  }

  const settingsMap = new Map((settings || []).map((row: any) => [String(row.setting_key), String(row.setting_value)]));
  const mergedTools = DEFAULT_SMART_TOOLS.map((defaults) => {
    const dbRow = (tools || []).find((row: any) => String(row.tool_id) === defaults.tool_id);
    return dbRow ? normalizeToolRow(dbRow, defaults) : defaults;
  });

  return normalizeSmartToolsHandlerConfig({
    section: readSectionFromMap(settingsMap),
    tools: mergedTools,
  });
}

export async function saveSmartToolsHandlerConfig(
  supabaseAdmin: any,
  input: Partial<SmartToolsHandlerConfig>,
  updatedBy?: string | null,
): Promise<SmartToolsHandlerConfig> {
  const next = normalizeSmartToolsHandlerConfig(input);

  await upsertSetting(supabaseAdmin, SECTION_KEYS.enabled, String(next.section.enabled), updatedBy);
  await upsertSetting(supabaseAdmin, SECTION_KEYS.title, next.section.title, updatedBy);
  await upsertSetting(supabaseAdmin, SECTION_KEYS.subtitle, next.section.subtitle, updatedBy);

  for (const tool of next.tools) {
    const legacyFlags = syncLegacyVisibilityFlags(tool.placements);
    const payload = {
      tool_id: tool.tool_id,
      title: tool.title,
      subtitle: tool.subtitle,
      tool_type: tool.tool_type,
      screen_name: tool.screen_name,
      default_web_url: tool.default_web_url,
      enabled: tool.enabled,
      membership_only: tool.membership_only,
      allowed_membership_plan_ids: tool.allowed_membership_plan_ids,
      allowed_phones: tool.allowed_phones,
      requires_login: tool.requires_login,
      show_on_home: legacyFlags.show_on_home,
      show_on_search: legacyFlags.show_on_search,
      placements: tool.placements,
      display_order: tool.display_order,
      title_override: tool.title_override,
      web_url_override: tool.web_url_override,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from(TABLE).upsert(payload, { onConflict: 'tool_id' });
    if (error) throw new Error(error.message || `Could not save ${tool.tool_id}`);
  }

  return getSmartToolsHandlerConfig(supabaseAdmin);
}
