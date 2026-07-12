import { ENV } from '../config/environment';
import { Alert } from 'react-native';
import {
  SMART_TOOLS,
  SMART_TOOL_WEB_URLS,
  smartToolWebUrl,
  type SmartToolId,
  type SmartToolItem,
} from '../constants/smartTools';
import {
  defaultSmartToolPlacements,
  isSmartToolPlacementEnabled,
  legacyPlacementsFromFlags,
  mergeSmartToolPlacements,
  normalizeAllowedPlanIds,
  parseSmartToolPlacements,
  type SmartToolPlacements,
  type SmartToolScreen,
} from './smartToolsPlacements';
import { apiFetch } from './api';
import { getCustomerSessionToken } from './customerSession';
import { isMembershipActive } from './membershipTheme';
import { supabase } from './supabase';

export type SmartToolConfigRow = {
  tool_id: string;
  title: string;
  subtitle?: string | null;
  tool_type: 'native' | 'webview';
  screen_name?: string | null;
  default_web_url?: string | null;
  enabled: boolean;
  membership_only: boolean;
  allowed_membership_plan_ids: string[];
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
  tools: SmartToolConfigRow[];
};

export type ResolvedSmartTool = SmartToolItem & {
  display_order: number;
  requires_login: boolean;
  membership_only: boolean;
  allowed_membership_plan_ids: string[];
  placements: SmartToolPlacements;
  webUrl?: string;
  locked?: boolean;
};

export type SmartToolsDisplayContext = {
  isLoggedIn: boolean;
  activeMembershipPlanId: string | null;
};

const DEFAULT_SECTION: SmartToolsSectionConfig = {
  enabled: true,
  title: 'Smart Tools',
  subtitle: 'Smart car utilities for health, pricing, fuel & more',
};

const DEFAULT_TOOLS: SmartToolConfigRow[] = SMART_TOOLS.map((tool, index) => ({
  tool_id: tool.id,
  title: tool.title,
  subtitle: null,
  tool_type: SMART_TOOL_WEB_URLS[tool.id] ? 'webview' : 'native',
  screen_name: tool.screen,
  default_web_url: SMART_TOOL_WEB_URLS[tool.id] || null,
  enabled: true,
  membership_only: false,
  allowed_membership_plan_ids: [],
  requires_login: false,
  show_on_home: true,
  show_on_search: true,
  placements: defaultSmartToolPlacements(),
  display_order: index + 1,
  title_override: null,
  web_url_override: null,
}));

export const DEFAULT_SMART_TOOLS_HANDLER: SmartToolsHandlerConfig = {
  section: DEFAULT_SECTION,
  tools: DEFAULT_TOOLS,
};

let cached: SmartToolsHandlerConfig | null = null;
let cachedAt = 0;
let inflight: Promise<SmartToolsHandlerConfig> | null = null;

function normalizeToolRow(raw: Partial<SmartToolConfigRow>, fallback: SmartToolConfigRow): SmartToolConfigRow {
  const hasPlacementData = raw.placements && typeof raw.placements === 'object' && Object.keys(raw.placements).length > 0;
  const placements = mergeSmartToolPlacements(
    hasPlacementData
      ? parseSmartToolPlacements(raw.placements)
      : legacyPlacementsFromFlags(
          raw.show_on_home !== undefined ? Boolean(raw.show_on_home) : fallback.show_on_home,
          raw.show_on_search !== undefined ? Boolean(raw.show_on_search) : fallback.show_on_search,
        ),
    fallback.placements,
  );
  const allowedPlanIds = normalizeAllowedPlanIds(raw.allowed_membership_plan_ids ?? fallback.allowed_membership_plan_ids);

  return {
    tool_id: String(raw.tool_id || fallback.tool_id) as SmartToolId,
    title: String(raw.title || fallback.title).trim() || fallback.title,
    subtitle: raw.subtitle != null ? String(raw.subtitle) : fallback.subtitle,
    tool_type: raw.tool_type === 'webview' ? 'webview' : 'native',
    screen_name: raw.screen_name != null ? String(raw.screen_name) : fallback.screen_name,
    default_web_url: raw.default_web_url != null ? String(raw.default_web_url) : fallback.default_web_url,
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : fallback.enabled,
    membership_only:
      allowedPlanIds.length > 0
        ? true
        : raw.membership_only !== undefined
          ? Boolean(raw.membership_only)
          : fallback.membership_only,
    allowed_membership_plan_ids: allowedPlanIds,
    requires_login: raw.requires_login !== undefined ? Boolean(raw.requires_login) : fallback.requires_login,
    show_on_home: raw.show_on_home !== undefined ? Boolean(raw.show_on_home) : fallback.show_on_home,
    show_on_search: raw.show_on_search !== undefined ? Boolean(raw.show_on_search) : fallback.show_on_search,
    placements,
    display_order: Number.isFinite(Number(raw.display_order))
      ? Math.max(0, Math.floor(Number(raw.display_order)))
      : fallback.display_order,
    title_override: raw.title_override != null ? String(raw.title_override) : fallback.title_override,
    web_url_override: raw.web_url_override != null ? String(raw.web_url_override) : fallback.web_url_override,
  };
}

export function normalizeSmartToolsHandlerConfig(raw: any): SmartToolsHandlerConfig {
  const byId = new Map(DEFAULT_TOOLS.map((tool) => [tool.tool_id, tool]));
  const sectionRaw = raw?.section || {};
  const toolsRaw = Array.isArray(raw?.tools) ? raw.tools : DEFAULT_TOOLS;

  const tools = toolsRaw
    .map((tool: Partial<SmartToolConfigRow>) => {
      const fallback = byId.get(String(tool.tool_id || '')) || DEFAULT_TOOLS[0];
      return normalizeToolRow(tool, fallback);
    })
    .sort((a: SmartToolConfigRow, b: SmartToolConfigRow) => a.display_order - b.display_order || a.title.localeCompare(b.title));

  return {
    section: {
      enabled: sectionRaw.enabled !== undefined ? Boolean(sectionRaw.enabled) : DEFAULT_SECTION.enabled,
      title: String(sectionRaw.title || DEFAULT_SECTION.title).trim() || DEFAULT_SECTION.title,
      subtitle: String(sectionRaw.subtitle || DEFAULT_SECTION.subtitle).trim() || DEFAULT_SECTION.subtitle,
    },
    tools: tools.length ? tools : DEFAULT_TOOLS,
  };
}

function mergeSmartToolItem(base: SmartToolItem, row: SmartToolConfigRow): ResolvedSmartTool {
  const webUrl =
    String(row.web_url_override || row.default_web_url || SMART_TOOL_WEB_URLS[base.id] || '').trim() || undefined;

  return {
    ...base,
    title: String(row.title_override || row.title || base.title).trim() || base.title,
    screen: String(row.screen_name || base.screen),
    display_order: row.display_order,
    requires_login: row.requires_login,
    membership_only: row.membership_only,
    allowed_membership_plan_ids: row.allowed_membership_plan_ids,
    placements: row.placements,
    webUrl,
  };
}

export function canUserSeeSmartTool(tool: Pick<SmartToolConfigRow, 'membership_only' | 'allowed_membership_plan_ids'>, context: SmartToolsDisplayContext): boolean {
  const planIds = normalizeAllowedPlanIds(tool.allowed_membership_plan_ids);
  const restricted = tool.membership_only || planIds.length > 0;
  if (!restricted) return true;
  if (!context.activeMembershipPlanId) return false;
  if (planIds.length === 0) return true;
  return planIds.includes(context.activeMembershipPlanId);
}

export function resolveSmartToolsForSlot(
  config: SmartToolsHandlerConfig,
  screen: SmartToolScreen,
  slot: string,
  context: SmartToolsDisplayContext,
): ResolvedSmartTool[] {
  if (!config.section.enabled) return [];

  return config.tools
    .filter((tool) => tool.enabled)
    .filter((tool) => isSmartToolPlacementEnabled(tool.placements, `${screen}.${slot}`))
    .map((tool) => {
      const base = SMART_TOOLS.find((item) => item.id === tool.tool_id);
      if (!base) return null;
      const resolved = mergeSmartToolItem(base, tool);
      if (!canUserSeeSmartTool(tool, context)) {
        resolved.locked = true;
      }
      return resolved;
    })
    .filter(Boolean)
    .sort((a, b) => a!.display_order - b!.display_order) as ResolvedSmartTool[];
}

export function navigateToSmartTool(
  navigation: any,
  tool: ResolvedSmartTool,
  opts: { city?: string; isLoggedIn: boolean },
) {
  if (tool.locked) {
    const planIds = normalizeAllowedPlanIds(tool.allowed_membership_plan_ids);
    const msg = planIds.length > 0
      ? `This tool is exclusively available for selected membership plan holders. Please upgrade your membership to access "${tool.title}".`
      : `This tool is exclusively available for MyFNG membership holders. Get a membership to unlock "${tool.title}".`;
    Alert.alert('Membership Required', msg, [{ text: 'OK' }]);
    return;
  }

  if (tool.requires_login && !opts.isLoggedIn) {
    navigation.navigate('Login');
    return;
  }

  if (tool.webUrl || tool.screen === 'SmartToolWeb') {
    navigation.navigate('SmartToolWeb', {
      title: tool.title,
      url: smartToolWebUrl(tool.id, tool.webUrl || SMART_TOOL_WEB_URLS[tool.id]),
      useLocation: tool.id === 'parking_finder',
      city: opts.city,
    });
    return;
  }

  navigation.navigate(tool.screen);
}

async function fetchSmartToolsConfigFromApi(): Promise<SmartToolsHandlerConfig | null> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/public/smart-tools/config?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('application/json')) return null;

    const json = await res.json().catch(() => null);
    if (!json?.config || typeof json.config !== 'object') return null;
    return normalizeSmartToolsHandlerConfig(json.config);
  } catch {
    return null;
  }
}

async function fetchSmartToolsConfigFromSupabase(): Promise<SmartToolsHandlerConfig | null> {
  try {
    const { data, error } = await supabase.rpc('get_public_smart_tools_config');
    if (error || !data) return null;
    return normalizeSmartToolsHandlerConfig(data);
  } catch {
    return null;
  }
}

export function invalidateSmartToolsConfigCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchSmartToolsHandlerConfig(force = false): Promise<SmartToolsHandlerConfig> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const fromApi = await fetchSmartToolsConfigFromApi();
    if (fromApi) return fromApi;

    const fromSupabase = await fetchSmartToolsConfigFromSupabase();
    if (fromSupabase) return fromSupabase;

    return DEFAULT_SMART_TOOLS_HANDLER;
  })()
    .then((value) => {
      cached = value;
      cachedAt = Date.now();
      inflight = null;
      return value;
    })
    .catch(() => {
      inflight = null;
      cached = DEFAULT_SMART_TOOLS_HANDLER;
      cachedAt = Date.now();
      return DEFAULT_SMART_TOOLS_HANDLER;
    });

  return inflight;
}

function toolNeedsMembershipLookup(tool: SmartToolConfigRow): boolean {
  if (!tool.enabled) return false;
  return tool.membership_only || normalizeAllowedPlanIds(tool.allowed_membership_plan_ids).length > 0;
}

export async function loadSmartToolsDisplayContext(config: SmartToolsHandlerConfig): Promise<SmartToolsDisplayContext> {
  const sessionToken = await getCustomerSessionToken();
  const isLoggedIn = Boolean(sessionToken);
  if (!isLoggedIn) {
    return { isLoggedIn: false, activeMembershipPlanId: null };
  }

  const needsMembership = config.tools.some(toolNeedsMembershipLookup);
  if (!needsMembership) {
    return { isLoggedIn: true, activeMembershipPlanId: null };
  }

  try {
    const memRes = await apiFetch<any>('/api/customer/membership');
    const membership = memRes?.membership;
    if (!isMembershipActive(membership)) {
      return { isLoggedIn: true, activeMembershipPlanId: null };
    }
    return {
      isLoggedIn: true,
      activeMembershipPlanId: membership?.plan_id ? String(membership.plan_id) : null,
    };
  } catch {
    return { isLoggedIn: true, activeMembershipPlanId: null };
  }
}
