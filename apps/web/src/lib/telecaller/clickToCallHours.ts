/**
 * Auto-dial calling hours (IST). Manual click-to-call is never blocked.
 * Global window + optional per-telecaller start/end override.
 */

import type { ClickToCallConfig } from '@/lib/telecaller/clickToCallConfig';

export const AUTO_DIAL_TZ = 'Asia/Kolkata';

/** Mon–Sat. Sunday off by default. JS weekday: 0=Sun … 6=Sat */
export const DEFAULT_AUTO_DIAL_DAYS = [1, 2, 3, 4, 5, 6];
export const DEFAULT_AUTO_DIAL_START = '10:00';
export const DEFAULT_AUTO_DIAL_END = '19:00';

export type TelecallerHourOverride = {
  start: string;
  end: string;
  days?: number[] | null;
  /** Inclusive IST dates YYYY-MM-DD (planned + emergency). */
  leave_from?: string | null;
  leave_to?: string | null;
  /** Emergency leave. Dates required (defaults to today). Without dates = today only. */
  on_leave?: boolean;
  /** Per-telecaller Fresh auto-dial. Undefined = on. */
  auto_dial_enabled?: boolean;
  /** Who gets auto-assigned leads on this person's weekly off days. */
  offday_cover_id?: string | null;
  /** Who gets auto-assigned leads while this person is on leave. */
  leave_cover_id?: string | null;
};

export type DialWindow = {
  start: string;
  end: string;
  days: number[];
  source: 'custom' | 'default';
  timezone: typeof AUTO_DIAL_TZ;
  leave_from: string | null;
  leave_to: string | null;
  on_leave: boolean;
  auto_dial_enabled: boolean;
};

export type DialWindowCheck = {
  allowed: boolean;
  reason: string;
  now_hhmm: string;
  weekday: number;
  weekday_label: string;
  window: DialWindow;
  today_ymd: string;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function normalizeHhmm(raw: unknown, fallback: string): string {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = m[2] !== undefined ? Number(m[2]) : 0;
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(min) || min < 0 || min > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function normalizeDays(raw: unknown, fallback: number[] = DEFAULT_AUTO_DIAL_DAYS): number[] {
  const src = Array.isArray(raw) ? raw : fallback;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of src) {
    const n = Number(item);
    if (!Number.isInteger(n) || n < 0 || n > 6 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.length ? out.sort((a, b) => a - b) : [...fallback];
}

export function normalizeYmd(raw: unknown): string | null {
  const s = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function getIstYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AUTO_DIAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isOnLeave(row: TelecallerHourOverride | null | undefined, todayYmd: string): boolean {
  if (!row) return false;
  let from = normalizeYmd(row.leave_from);
  let to = normalizeYmd(row.leave_to);
  if (!from && !to && row.on_leave) {
    from = todayYmd;
    to = todayYmd;
  }
  if (!from && !to) return false;
  if (from && todayYmd < from) return false;
  if (to && todayYmd > to) return false;
  return true;
}

export type SanitizedLeaveRange = {
  leave_from: string | null;
  leave_to: string | null;
  on_leave: boolean;
  error?: string;
};

/** Planned + emergency leave. Past-only ranges are cleared. Emergency without dates = today. */
export function sanitizeLeaveRange(
  input: {
    leave_from?: string | null;
    leave_to?: string | null;
    on_leave?: boolean;
  },
  todayYmd: string = getIstYmd(),
): SanitizedLeaveRange {
  let from = normalizeYmd(input.leave_from);
  let to = normalizeYmd(input.leave_to);
  const on_leave = Boolean(input.on_leave);

  if (on_leave && !from && !to) {
    from = todayYmd;
    to = todayYmd;
  }
  if (from && !to) to = from;
  if (to && !from) from = to < todayYmd ? todayYmd : to;

  if (!from && !to) {
    return { leave_from: null, leave_to: null, on_leave: false };
  }

  if (from && to && from > to) {
    to = from;
  }

  const rangeEnded = Boolean(to && to < todayYmd);
  if (rangeEnded) {
    if (on_leave) {
      return { leave_from: todayYmd, leave_to: todayYmd, on_leave: true };
    }
    return { leave_from: null, leave_to: null, on_leave: false };
  }

  return { leave_from: from, leave_to: to, on_leave };
}

export function normalizeTelecallerHours(
  raw: unknown,
): Record<string, TelecallerHourOverride> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, TelecallerHourOverride> = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    const tid = String(id || '').trim();
    if (!tid || !val || typeof val !== 'object') continue;
    const row = val as any;
    const start = normalizeHhmm(row.start, '');
    const end = normalizeHhmm(row.end, '');
    const days = Array.isArray(row.days) ? normalizeDays(row.days) : null;
    const leave = sanitizeLeaveRange({
      leave_from: row.leave_from,
      leave_to: row.leave_to,
      on_leave: Boolean(row.on_leave),
    });
    const leave_from = leave.leave_from;
    const leave_to = leave.leave_to;
    const on_leave = leave.on_leave;
    const auto_dial_enabled =
      row.auto_dial_enabled === undefined ? true : Boolean(row.auto_dial_enabled);
    const offday_cover_id = String(row.offday_cover_id || '').trim() || null;
    const leave_cover_id = String(row.leave_cover_id || '').trim() || null;
    if (
      !start &&
      !end &&
      !days &&
      !leave_from &&
      !leave_to &&
      !on_leave &&
      row.auto_dial_enabled === undefined &&
      !offday_cover_id &&
      !leave_cover_id
    ) {
      continue;
    }
    out[tid] = {
      start: start || DEFAULT_AUTO_DIAL_START,
      end: end || DEFAULT_AUTO_DIAL_END,
      days,
      leave_from,
      leave_to,
      on_leave,
      auto_dial_enabled,
      offday_cover_id,
      leave_cover_id,
    };
  }
  return out;
}

export function getIstClock(now: Date = new Date()): { hhmm: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AUTO_DIAL_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const wdRaw = String(parts.find((p) => p.type === 'weekday')?.value || '').slice(0, 3);
  const weekday = Math.max(
    0,
    WEEKDAY_LABELS.findIndex((d) => d.toLowerCase() === wdRaw.toLowerCase()),
  );
  const hh = Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0;
  const mm = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
  return {
    hhmm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    weekday,
    minutes: hh * 60 + mm,
  };
}

export function formatDaysLabel(days: number[]): string {
  const sorted = normalizeDays(days);
  if (sorted.length === 7) return 'All days';
  if (sorted.join() === '1,2,3,4,5,6') return 'Mon–Sat';
  if (sorted.join() === '1,2,3,4,5') return 'Mon–Fri';
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(', ');
}

export function resolveDialWindow(
  cfg: ClickToCallConfig,
  telecallerId?: string | null,
): DialWindow {
  const fallback: DialWindow = {
    start: normalizeHhmm(cfg.auto_dial_start, DEFAULT_AUTO_DIAL_START),
    end: normalizeHhmm(cfg.auto_dial_end, DEFAULT_AUTO_DIAL_END),
    days: normalizeDays(cfg.auto_dial_days),
    source: 'default',
    timezone: AUTO_DIAL_TZ,
    leave_from: null,
    leave_to: null,
    on_leave: false,
    auto_dial_enabled: true,
  };
  const tid = String(telecallerId || '').trim();
  if (!tid) return fallback;
  const custom = cfg.telecaller_hours?.[tid];
  if (!custom) return fallback;
  const hasCustom =
    Boolean(custom.start) ||
    Boolean(custom.end) ||
    Array.isArray(custom.days) ||
    Boolean(custom.leave_from) ||
    Boolean(custom.leave_to) ||
    Boolean(custom.on_leave) ||
    custom.auto_dial_enabled === false;
  return {
    start: normalizeHhmm(custom.start, fallback.start),
    end: normalizeHhmm(custom.end, fallback.end),
    days: Array.isArray(custom.days) ? normalizeDays(custom.days) : fallback.days,
    source: hasCustom ? 'custom' : 'default',
    timezone: AUTO_DIAL_TZ,
    leave_from: normalizeYmd(custom.leave_from),
    leave_to: normalizeYmd(custom.leave_to),
    on_leave: Boolean(custom.on_leave),
    auto_dial_enabled: custom.auto_dial_enabled !== false,
  };
}

function minutesInWindow(current: number, start: string, end: string): boolean {
  const startMin = hhmmToMinutes(start);
  const endMin = hhmmToMinutes(end);
  if (startMin == null || endMin == null) return true;
  if (startMin === endMin) return true;
  if (startMin < endMin) return current >= startMin && current < endMin;
  return current >= startMin || current < endMin;
}

export function evaluateAutoDialWindow(
  cfg: ClickToCallConfig,
  telecallerId?: string | null,
  now: Date = new Date(),
): DialWindowCheck {
  const window = resolveDialWindow(cfg, telecallerId);
  const clock = getIstClock(now);
  const today_ymd = getIstYmd(now);
  const tid = String(telecallerId || '').trim();
  const custom = tid ? cfg.telecaller_hours?.[tid] : null;

  const base = {
    now_hhmm: clock.hhmm,
    weekday: clock.weekday,
    weekday_label: WEEKDAY_LABELS[clock.weekday],
    window,
    today_ymd,
  };

  if (custom?.auto_dial_enabled === false) {
    return { allowed: false, reason: 'auto_dial_off', ...base };
  }

  if (!cfg.auto_dial_hours_enabled) {
    return { allowed: true, reason: 'hours_disabled', ...base };
  }

  if (isOnLeave(custom || window, today_ymd)) {
    return { allowed: false, reason: `on_leave_${window.leave_from || today_ymd}_${window.leave_to || 'open'}`, ...base };
  }

  if (!window.days.includes(clock.weekday)) {
    return { allowed: false, reason: `off_day_${WEEKDAY_LABELS[clock.weekday]}`, ...base };
  }

  if (!minutesInWindow(clock.minutes, window.start, window.end)) {
    return { allowed: false, reason: `outside_hours_${window.start}_${window.end}`, ...base };
  }

  return { allowed: true, reason: 'in_hours', ...base };
}

export function publicAutoDialHours(cfg: ClickToCallConfig) {
  const global = evaluateAutoDialWindow(cfg, null);
  return {
    auto_dial_hours_enabled: Boolean(cfg.auto_dial_hours_enabled),
    auto_dial_start: normalizeHhmm(cfg.auto_dial_start, DEFAULT_AUTO_DIAL_START),
    auto_dial_end: normalizeHhmm(cfg.auto_dial_end, DEFAULT_AUTO_DIAL_END),
    auto_dial_days: normalizeDays(cfg.auto_dial_days),
    auto_dial_days_label: formatDaysLabel(cfg.auto_dial_days),
    telecaller_hours: cfg.telecaller_hours || {},
    timezone: AUTO_DIAL_TZ,
    clock: {
      now_hhmm: global.now_hhmm,
      weekday_label: global.weekday_label,
      open: global.allowed,
      reason: global.reason,
    },
  };
}

export type AssignmentBlockReason = 'ok' | 'off_day' | 'on_leave';

export type AssignmentAvailability = {
  available: boolean;
  reason: AssignmentBlockReason;
  cover_id: string | null;
  weekday: number;
  today_ymd: string;
};

/** Lead assignment (not auto-dial): skip weekly off + leave. Hours / autodial toggle ignored. */
export function getAssignmentAvailability(
  cfg: ClickToCallConfig,
  telecallerId?: string | null,
  now: Date = new Date(),
): AssignmentAvailability {
  const tid = String(telecallerId || '').trim();
  const window = resolveDialWindow(cfg, tid);
  const clock = getIstClock(now);
  const today_ymd = getIstYmd(now);
  const custom = tid ? cfg.telecaller_hours?.[tid] : null;

  if (tid && isOnLeave(custom || window, today_ymd)) {
    return {
      available: false,
      reason: 'on_leave',
      cover_id: custom?.leave_cover_id || custom?.offday_cover_id || null,
      weekday: clock.weekday,
      today_ymd,
    };
  }

  if (tid && !window.days.includes(clock.weekday)) {
    return {
      available: false,
      reason: 'off_day',
      cover_id: custom?.offday_cover_id || custom?.leave_cover_id || null,
      weekday: clock.weekday,
      today_ymd,
    };
  }

  return {
    available: true,
    reason: 'ok',
    cover_id: null,
    weekday: clock.weekday,
    today_ymd,
  };
}

/** Follow cover chain (max 4 hops). Returns null if cover is also unavailable / cycle. */
export function resolveAvailableCoverId(
  cfg: ClickToCallConfig,
  telecallerId: string,
  now: Date = new Date(),
): string | null {
  const seen = new Set<string>();
  let current = String(telecallerId || '').trim();
  for (let i = 0; i < 4; i += 1) {
    if (!current || seen.has(current)) return null;
    seen.add(current);
    const avail = getAssignmentAvailability(cfg, current, now);
    if (avail.available) return i === 0 ? null : current;
    current = String(avail.cover_id || '').trim();
  }
  return null;
}
