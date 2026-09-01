import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  DEFAULT_AUTO_DIAL_DAYS,
  DEFAULT_AUTO_DIAL_END,
  DEFAULT_AUTO_DIAL_START,
  normalizeDays,
  normalizeHhmm,
  normalizeTelecallerHours,
  publicAutoDialHours,
  type TelecallerHourOverride,
} from '@/lib/telecaller/clickToCallHours';

export const CLICK_TO_CALL_SETTING_KEY = 'click_to_call_smartflo';

export const DEFAULT_CLICK_TO_CALL_GATEWAY =
  'https://qzmhqiwviyftoppuhkpy.supabase.co/functions/v1/click-to-call-gateway';
export const DEFAULT_CLICK_TO_CALL_DID = '919262190064';
export const DEFAULT_CLICK_TO_CALL_PROVIDER = 'smartflo';

/** Smartflo DIDs available for assignment (numbers_assign). */
export const DEFAULT_CLICK_TO_CALL_DIDS = [
  '919262190064',
  '919262183526',
  '919240213316',
  '919240204288',
  '919240203202',
] as const;

export type DidAssignment = {
  did: string;
  /** users_login id of TELECALLER (or null = unassigned) */
  telecaller_id: string | null;
};

export type ClickToCallDialMode = 'agent_first' | 'customer_first';

export type ClickToCallConfig = {
  enabled: boolean;
  gateway_url: string;
  /** Fallback DID when telecaller has no assignment */
  did: string;
  provider: string;
  /** Optional Bearer for Supabase edge function */
  gateway_key: string;
  /** Pool of DIDs (typically 5) */
  dids: string[];
  /** Which telecaller uses which DID */
  did_assignments: DidAssignment[];
  /**
   * agent_first (default): ring telecaller, then customer after answer.
   * customer_first: Smartflo support-style (customer rings first).
   */
  dial_mode: ClickToCallDialMode;
  /** Optional Smartflo Bearer token for direct /v1/click_to_call (agent-first). */
  smartflo_api_token: string;
  /** When Fresh/NEW lead is assigned, auto-start agent-first call. */
  auto_dial_on_fresh_assign: boolean;
  /** When true, Fresh auto-dial only fires inside the IST window (manual Call stays open). */
  auto_dial_hours_enabled: boolean;
  auto_dial_start: string;
  auto_dial_end: string;
  /** 0=Sun … 6=Sat */
  auto_dial_days: number[];
  /** Per-telecaller start/end override (empty = use global). */
  telecaller_hours: Record<string, TelecallerHourOverride>;
};

function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

function normalizeDidList(raw: unknown, fallback: string[]): string[] {
  const list = Array.isArray(raw) ? raw : fallback;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const d = digitsOnly(item);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.length ? out : [...fallback];
}

function normalizeAssignments(
  raw: unknown,
  dids: string[],
): DidAssignment[] {
  const byDid = new Map<string, string | null>();
  for (const did of dids) byDid.set(did, null);

  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const did = digitsOnly((row as any).did);
      if (!did || !byDid.has(did)) continue;
      const tid = (row as any).telecaller_id;
      byDid.set(did, tid ? String(tid).trim() || null : null);
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // legacy map { telecallerId: did } or { did: telecallerId }
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const kDigits = digitsOnly(k);
      const vDigits = digitsOnly(v);
      if (dids.includes(kDigits)) {
        byDid.set(kDigits, v ? String(v).trim() || null : null);
      } else if (dids.includes(vDigits)) {
        byDid.set(vDigits, String(k).trim() || null);
      }
    }
  }

  // Ensure one telecaller → at most one DID (last wins if duplicates)
  const usedTc = new Set<string>();
  const ordered = dids.map((did) => {
    let tid = byDid.get(did) || null;
    if (tid && usedTc.has(tid)) tid = null;
    if (tid) usedTc.add(tid);
    return { did, telecaller_id: tid };
  });
  return ordered;
}

export function defaultClickToCallConfig(): ClickToCallConfig {
  const dids = [...DEFAULT_CLICK_TO_CALL_DIDS];
  return {
    enabled: true,
    gateway_url:
      String(process.env.CLICK_TO_CALL_GATEWAY_URL || '').trim() || DEFAULT_CLICK_TO_CALL_GATEWAY,
    did: String(process.env.CLICK_TO_CALL_DID || '').replace(/\D/g, '') || DEFAULT_CLICK_TO_CALL_DID,
    provider:
      String(process.env.CLICK_TO_CALL_PROVIDER || '').trim().toLowerCase() ||
      DEFAULT_CLICK_TO_CALL_PROVIDER,
    gateway_key: String(
      process.env.CLICK_TO_CALL_GATEWAY_KEY || process.env.CLICK_TO_CALL_ANON_KEY || '',
    ).trim(),
    dids,
    did_assignments: dids.map((did) => ({ did, telecaller_id: null })),
    dial_mode: 'agent_first',
    smartflo_api_token: String(process.env.SMARTFLO_API_TOKEN || '').trim(),
    auto_dial_on_fresh_assign: true,
    auto_dial_hours_enabled: true,
    auto_dial_start: DEFAULT_AUTO_DIAL_START,
    auto_dial_end: DEFAULT_AUTO_DIAL_END,
    auto_dial_days: [...DEFAULT_AUTO_DIAL_DAYS],
    telecaller_hours: {},
  };
}

function parseConfig(raw: unknown): ClickToCallConfig {
  const base = defaultClickToCallConfig();
  if (!raw) return base;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return base;
    }
  }
  if (!obj || typeof obj !== 'object') return base;

  const dids = normalizeDidList(obj.dids, base.dids);
  const fallbackDid = digitsOnly(obj.did) || dids[0] || base.did;
  const dialModeRaw = String(obj.dial_mode || base.dial_mode || 'agent_first')
    .trim()
    .toLowerCase();
  const dial_mode: ClickToCallDialMode =
    dialModeRaw === 'customer_first' ? 'customer_first' : 'agent_first';

  return {
    enabled: obj.enabled === undefined ? true : Boolean(obj.enabled),
    gateway_url: String(obj.gateway_url || base.gateway_url).trim() || base.gateway_url,
    did: fallbackDid,
    provider: String(obj.provider || base.provider).trim().toLowerCase() || base.provider,
    gateway_key:
      obj.gateway_key !== undefined && obj.gateway_key !== null
        ? String(obj.gateway_key).trim()
        : base.gateway_key,
    dids,
    did_assignments: normalizeAssignments(obj.did_assignments, dids),
    dial_mode,
    smartflo_api_token:
      obj.smartflo_api_token !== undefined && obj.smartflo_api_token !== null
        ? String(obj.smartflo_api_token).trim()
        : base.smartflo_api_token,
    auto_dial_on_fresh_assign:
      obj.auto_dial_on_fresh_assign === undefined
        ? base.auto_dial_on_fresh_assign
        : Boolean(obj.auto_dial_on_fresh_assign),
    auto_dial_hours_enabled:
      obj.auto_dial_hours_enabled === undefined
        ? base.auto_dial_hours_enabled
        : Boolean(obj.auto_dial_hours_enabled),
    auto_dial_start: normalizeHhmm(obj.auto_dial_start, base.auto_dial_start),
    auto_dial_end: normalizeHhmm(obj.auto_dial_end, base.auto_dial_end),
    auto_dial_days: normalizeDays(obj.auto_dial_days, base.auto_dial_days),
    telecaller_hours: normalizeTelecallerHours(obj.telecaller_hours),
  };
}

export async function getClickToCallConfig(): Promise<ClickToCallConfig> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return defaultClickToCallConfig();

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', CLICK_TO_CALL_SETTING_KEY)
    .maybeSingle();

  const fromDb = parseConfig(data?.setting_value);
  if (!fromDb.gateway_key) {
    fromDb.gateway_key = defaultClickToCallConfig().gateway_key;
  }
  if (!fromDb.smartflo_api_token) {
    fromDb.smartflo_api_token = defaultClickToCallConfig().smartflo_api_token;
  }
  return fromDb;
}

export async function saveClickToCallConfig(
  partial: Partial<ClickToCallConfig> & {
    clear_gateway_key?: boolean;
    clear_smartflo_api_token?: boolean;
  },
): Promise<ClickToCallConfig> {
  const current = await getClickToCallConfig();
  const nextDids =
    partial.dids !== undefined
      ? normalizeDidList(partial.dids, current.dids)
      : current.dids;

  const next: ClickToCallConfig = {
    enabled: partial.enabled !== undefined ? Boolean(partial.enabled) : current.enabled,
    gateway_url:
      partial.gateway_url !== undefined
        ? String(partial.gateway_url || '').trim() || DEFAULT_CLICK_TO_CALL_GATEWAY
        : current.gateway_url,
    did:
      partial.did !== undefined
        ? digitsOnly(partial.did) || nextDids[0] || DEFAULT_CLICK_TO_CALL_DID
        : current.did,
    provider:
      partial.provider !== undefined
        ? String(partial.provider || '').trim().toLowerCase() || DEFAULT_CLICK_TO_CALL_PROVIDER
        : current.provider,
    gateway_key: current.gateway_key,
    dids: nextDids,
    did_assignments:
      partial.did_assignments !== undefined
        ? normalizeAssignments(partial.did_assignments, nextDids)
        : normalizeAssignments(current.did_assignments, nextDids),
    dial_mode:
      partial.dial_mode === 'customer_first'
        ? 'customer_first'
        : partial.dial_mode === 'agent_first'
          ? 'agent_first'
          : current.dial_mode || 'agent_first',
    smartflo_api_token: current.smartflo_api_token,
    auto_dial_on_fresh_assign:
      partial.auto_dial_on_fresh_assign !== undefined
        ? Boolean(partial.auto_dial_on_fresh_assign)
        : current.auto_dial_on_fresh_assign,
    auto_dial_hours_enabled:
      partial.auto_dial_hours_enabled !== undefined
        ? Boolean(partial.auto_dial_hours_enabled)
        : current.auto_dial_hours_enabled,
    auto_dial_start:
      partial.auto_dial_start !== undefined
        ? normalizeHhmm(partial.auto_dial_start, current.auto_dial_start)
        : current.auto_dial_start,
    auto_dial_end:
      partial.auto_dial_end !== undefined
        ? normalizeHhmm(partial.auto_dial_end, current.auto_dial_end)
        : current.auto_dial_end,
    auto_dial_days:
      partial.auto_dial_days !== undefined
        ? normalizeDays(partial.auto_dial_days, current.auto_dial_days)
        : current.auto_dial_days,
    telecaller_hours:
      partial.telecaller_hours !== undefined
        ? normalizeTelecallerHours(partial.telecaller_hours)
        : current.telecaller_hours,
  };

  if (partial.clear_gateway_key) {
    next.gateway_key = '';
  } else if (partial.gateway_key !== undefined && String(partial.gateway_key).trim()) {
    next.gateway_key = String(partial.gateway_key).trim();
  }

  if (partial.clear_smartflo_api_token) {
    next.smartflo_api_token = '';
  } else if (
    partial.smartflo_api_token !== undefined &&
    String(partial.smartflo_api_token).trim()
  ) {
    next.smartflo_api_token = String(partial.smartflo_api_token).trim();
  }

  // Keep fallback did inside pool when possible
  if (!next.dids.includes(next.did) && next.dids[0]) {
    next.did = next.dids[0];
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Admin client unavailable');

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: CLICK_TO_CALL_SETTING_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'JSON',
      category: 'TELEPHONY',
      description: 'Smartflo click-to-call gateway, DID pool & telecaller assignments',
      is_editable: true,
      requires_restart: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message || 'Failed to save click-to-call settings');
  return next;
}

function didKey(raw: unknown): string {
  const d = digitsOnly(raw);
  return d.length >= 10 ? d.slice(-10) : d;
}

/** Who exclusively owns this DID, or null if unassigned / unknown. */
export function ownerOfDid(
  cfg: ClickToCallConfig,
  did: string | null | undefined,
): string | null {
  const key = didKey(did);
  if (!key) return null;
  const hit = cfg.did_assignments.find((a) => didKey(a.did) === key && a.telecaller_id);
  return hit?.telecaller_id ? String(hit.telecaller_id).trim() : null;
}

/** DIDs that are assigned to a telecaller (Ajit / Mahendra click-to-call lines). */
export function assignedDidPhoneSet(cfg: ClickToCallConfig): Set<string> {
  const set = new Set<string>();
  for (const a of cfg.did_assignments || []) {
    if (!a.telecaller_id || !a.did) continue;
    const p = didKey(a.did);
    if (p) set.add(p);
  }
  return set;
}

export function telecallerIdForDid(cfg: ClickToCallConfig, did: unknown): string | null {
  return ownerOfDid(cfg, String(did || ''));
}

export type ExclusiveDidResult =
  | { ok: true; did: string; source: 'assigned' | 'unassigned_pool' | 'requested' }
  | { ok: false; error: string; code: 'DID_EXCLUSIVE' | 'NO_DID_ASSIGNED' };

/**
 * Assigned DIDs are exclusive (Ajit / Mahendra etc. cannot be used by anyone else).
 * Unassigned telecallers may only use an unassigned pool DID — never someone else's.
 */
export function resolveExclusiveDidForTelecaller(
  cfg: ClickToCallConfig,
  telecallerId: string | null | undefined,
  requestedDid?: string | null,
): ExclusiveDidResult {
  const tid = String(telecallerId || '').trim();
  const assignedToMe = tid
    ? cfg.did_assignments.find((a) => a.telecaller_id === tid && a.did)
    : undefined;

  const req = digitsOnly(requestedDid);
  if (req) {
    const owner = ownerOfDid(cfg, req);
    if (owner && owner !== tid) {
      return {
        ok: false,
        error: `DID ${didKey(req)} is assigned exclusively to another telecaller.`,
        code: 'DID_EXCLUSIVE',
      };
    }
    if (assignedToMe?.did && didKey(assignedToMe.did) !== didKey(req)) {
      return {
        ok: false,
        error: `This telecaller can only use their assigned DID (${didKey(assignedToMe.did)}).`,
        code: 'DID_EXCLUSIVE',
      };
    }
    return { ok: true, did: req, source: 'requested' };
  }

  if (assignedToMe?.did) {
    return { ok: true, did: assignedToMe.did, source: 'assigned' };
  }

  const unassigned = cfg.did_assignments.filter((a) => a.did && !a.telecaller_id);
  const fallbackKey = didKey(cfg.did);
  const preferred =
    fallbackKey && !ownerOfDid(cfg, cfg.did)
      ? unassigned.find((a) => didKey(a.did) === fallbackKey)
      : undefined;
  const pick = preferred || unassigned[0];
  if (pick?.did) {
    return { ok: true, did: pick.did, source: 'unassigned_pool' };
  }

  return {
    ok: false,
    error: tid
      ? 'No caller ID assigned to this telecaller. Ask Super Admin to assign a dedicated DID — assigned numbers cannot be shared.'
      : 'No unassigned DID available. Assigned caller IDs cannot be shared.',
    code: 'NO_DID_ASSIGNED',
  };
}

/** Resolve exclusive DID; empty string if none (never returns someone else's assigned DID). */
export function resolveDidForTelecaller(
  cfg: ClickToCallConfig,
  telecallerId: string | null | undefined,
): string {
  const resolved = resolveExclusiveDidForTelecaller(cfg, telecallerId);
  return resolved.ok ? resolved.did : '';
}

/** Public-safe view (mask secrets). */
export function publicClickToCallConfig(cfg: ClickToCallConfig) {
  return {
    enabled: cfg.enabled,
    gateway_url: cfg.gateway_url,
    did: cfg.did,
    provider: cfg.provider,
    has_gateway_key: Boolean(cfg.gateway_key),
    dids: cfg.dids,
    did_assignments: cfg.did_assignments,
    dial_mode: cfg.dial_mode || 'agent_first',
    has_smartflo_api_token: Boolean(cfg.smartflo_api_token),
    auto_dial_on_fresh_assign: Boolean(cfg.auto_dial_on_fresh_assign),
    ...publicAutoDialHours(cfg),
  };
}
