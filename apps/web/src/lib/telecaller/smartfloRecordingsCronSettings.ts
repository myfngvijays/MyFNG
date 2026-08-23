/**
 * Admin-configurable Smartflo call-recording sync cron.
 * Vercel pings /api/cron/smartflo-recordings frequently; this settings row
 * controls ON/OFF + effective interval (skip until interval elapsed).
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { SMARTFLO_RECORDINGS_CUTOFF_IST } from '@/lib/telecaller/smartfloCdr';

export const SMARTFLO_RECORDINGS_CRON_SETTING_KEY = 'smartflo_recordings_cron';

export const SMARTFLO_RECORDINGS_CRON_INTERVALS = [5, 10, 15, 30, 60] as const;
export type SmartfloRecordingsCronInterval =
  (typeof SMARTFLO_RECORDINGS_CRON_INTERVALS)[number];

export type SmartfloRecordingsCronSettings = {
  enabled: boolean;
  /** Effective sync cadence (minutes). Vercel tick may be more frequent. */
  interval_minutes: SmartfloRecordingsCronInterval;
  /** CDR lookback window when cron runs */
  hours_back: number;
  last_run_at: string | null;
  last_run_ok: boolean | null;
  last_run_summary: string | null;
  last_skipped_at: string | null;
  last_skip_reason: string | null;
};

const DEFAULTS: SmartfloRecordingsCronSettings = {
  enabled: true,
  interval_minutes: 15,
  hours_back: 6,
  last_run_at: null,
  last_run_ok: null,
  last_run_summary: null,
  last_skipped_at: null,
  last_skip_reason: null,
};

function clampInterval(raw: unknown): SmartfloRecordingsCronInterval {
  const n = Number(raw);
  if ((SMARTFLO_RECORDINGS_CRON_INTERVALS as readonly number[]).includes(n)) {
    return n as SmartfloRecordingsCronInterval;
  }
  return DEFAULTS.interval_minutes;
}

function clampHoursBack(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULTS.hours_back;
  return Math.min(72, Math.max(1, Math.round(n)));
}

function parseSettings(raw: unknown): SmartfloRecordingsCronSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULTS };
    const v = value as Record<string, unknown>;
    return {
      enabled: v.enabled === undefined ? true : Boolean(v.enabled),
      interval_minutes: clampInterval(v.interval_minutes),
      hours_back: clampHoursBack(v.hours_back),
      last_run_at: v.last_run_at ? String(v.last_run_at) : null,
      last_run_ok: typeof v.last_run_ok === 'boolean' ? v.last_run_ok : null,
      last_run_summary: v.last_run_summary ? String(v.last_run_summary) : null,
      last_skipped_at: v.last_skipped_at ? String(v.last_skipped_at) : null,
      last_skip_reason: v.last_skip_reason ? String(v.last_skip_reason) : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function getSmartfloRecordingsCronSettings(): Promise<SmartfloRecordingsCronSettings> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ...DEFAULTS };
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SMARTFLO_RECORDINGS_CRON_SETTING_KEY)
    .maybeSingle();
  return parseSettings(data?.setting_value);
}

async function writeSettings(
  next: SmartfloRecordingsCronSettings,
  updatedBy?: string | null,
): Promise<{ ok: true; settings: SmartfloRecordingsCronSettings } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Database admin client unavailable' };

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SMARTFLO_RECORDINGS_CRON_SETTING_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'JSON',
      category: 'INTEGRATIONS',
      description:
        'Smartflo call recording sync cron: enabled, interval_minutes, hours_back, last run meta.',
      default_value: JSON.stringify(DEFAULTS),
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );

  if (error) return { ok: false, error: error.message || 'Failed to save settings' };
  return { ok: true, settings: next };
}

export async function updateSmartfloRecordingsCronSettings(
  patch: {
    enabled?: boolean;
    interval_minutes?: number;
    hours_back?: number;
  },
  updatedBy?: string | null,
): Promise<{ ok: true; settings: SmartfloRecordingsCronSettings } | { ok: false; error: string }> {
  const current = await getSmartfloRecordingsCronSettings();
  const next: SmartfloRecordingsCronSettings = {
    ...current,
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
    interval_minutes:
      patch.interval_minutes !== undefined
        ? clampInterval(patch.interval_minutes)
        : current.interval_minutes,
    hours_back:
      patch.hours_back !== undefined ? clampHoursBack(patch.hours_back) : current.hours_back,
  };
  return writeSettings(next, updatedBy);
}

export async function markSmartfloRecordingsCronRun(input: {
  ok: boolean;
  summary: string;
}): Promise<void> {
  const current = await getSmartfloRecordingsCronSettings();
  await writeSettings({
    ...current,
    last_run_at: new Date().toISOString(),
    last_run_ok: Boolean(input.ok),
    last_run_summary: String(input.summary || '').slice(0, 500),
    last_skipped_at: null,
    last_skip_reason: null,
  });
}

export async function markSmartfloRecordingsCronSkipped(reason: string): Promise<void> {
  const current = await getSmartfloRecordingsCronSettings();
  await writeSettings({
    ...current,
    last_skipped_at: new Date().toISOString(),
    last_skip_reason: String(reason || '').slice(0, 200),
  });
}

/**
 * Decide whether the Vercel tick should actually sync.
 * `force=1` (admin Run now) bypasses interval + enabled gate for the run path —
 * callers should pass force only for intentional manual runs.
 */
export function shouldRunSmartfloRecordingsCron(
  settings: SmartfloRecordingsCronSettings,
  opts?: { force?: boolean; nowMs?: number },
): { run: true } | { run: false; reason: string; retry_after_ms?: number } {
  if (opts?.force) return { run: true };
  if (!settings.enabled) {
    return { run: false, reason: 'disabled_in_admin' };
  }
  const now = opts?.nowMs ?? Date.now();
  const last = settings.last_run_at ? Date.parse(settings.last_run_at) : NaN;
  if (Number.isFinite(last)) {
    const elapsed = now - last;
    const need = settings.interval_minutes * 60 * 1000;
    if (elapsed < need) {
      return {
        run: false,
        reason: 'interval_not_elapsed',
        retry_after_ms: need - elapsed,
      };
    }
  }
  return { run: true };
}

export function smartfloRecordingsCronAdminPayload(
  settings: SmartfloRecordingsCronSettings,
  baseUrl: string,
) {
  return {
    id: 'smartflo-recordings',
    title: 'Smartflo call recordings sync',
    description: `Pulls Smartflo CDR recording URLs into CRM Call Activity (Play). Only on/after ${SMARTFLO_RECORDINGS_CUTOFF_IST} IST.`,
    provider: 'Vercel cron → /api/cron/smartflo-recordings',
    endpoint_path: '/api/cron/smartflo-recordings',
    endpoint_url: `${baseUrl.replace(/\/$/, '')}/api/cron/smartflo-recordings`,
    vercel_tick: '*/5 * * * *',
    vercel_tick_label: 'Vercel checks every 5 min; effective interval set below',
    cutoff_ist: SMARTFLO_RECORDINGS_CUTOFF_IST,
    allowed_intervals: [...SMARTFLO_RECORDINGS_CRON_INTERVALS],
    setup_link: '/dashboard/super_admin/click-to-call',
    ...settings,
    schedule_label: settings.enabled
      ? `Every ${settings.interval_minutes} min · last ${settings.hours_back}h CDR`
      : 'OFF — Vercel tick will skip',
  };
}
