export type GoogleAdsDatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK_SUN_TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_WEEK_SUN_SAT'
  | 'LAST_14_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_30_TO_TODAY'
  | 'ALL_TIME'
  | 'CUSTOM';

export type DateRangeInput = {
  during?: string;
  since?: string;
  until?: string;
};

const GAQL_PRESETS = new Set([
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'LAST_14_DAYS',
  'LAST_30_DAYS',
  'LAST_BUSINESS_WEEK',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_WEEK_SUN_TODAY',
  'THIS_WEEK_MON_TODAY',
  'LAST_WEEK_SUN_SAT',
  'LAST_WEEK_MON_SUN',
]);

export const GOOGLE_ADS_DATE_PRESETS: { id: GoogleAdsDatePreset; label: string }[] = [
  { id: 'CUSTOM', label: 'Custom' },
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'THIS_WEEK_SUN_TODAY', label: 'This week (Sun – Today)' },
  { id: 'LAST_7_DAYS', label: 'Last 7 days' },
  { id: 'LAST_WEEK_SUN_SAT', label: 'Last week (Sun – Sat)' },
  { id: 'LAST_14_DAYS', label: 'Last 14 days' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
  { id: 'LAST_30_DAYS', label: 'Last 30 days' },
  { id: 'ALL_TIME', label: 'All time' },
  { id: 'LAST_30_TO_TODAY', label: '30 days up to today' },
];

export function istYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function startOfWeekSunday(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  return addDays(ymd, -dow);
}

function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function lastMonthBounds(ymd: string): { since: string; until: string } {
  const [y, m] = ymd.split('-').map(Number);
  const firstThis = new Date(Date.UTC(y, m - 1, 1));
  const lastPrev = new Date(firstThis.getTime() - 86400000);
  const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
  return {
    since: firstPrev.toISOString().slice(0, 10),
    until: lastPrev.toISOString().slice(0, 10),
  };
}

export function resolveDateBounds(input: DateRangeInput = {}): { since: string; until: string; preset: string } {
  const today = istYmd();
  const preset = String(input.during || 'LAST_7_DAYS').toUpperCase().replace(/-/g, '_');
  const customSince = String(input.since || '').slice(0, 10);
  const customUntil = String(input.until || '').slice(0, 10);
  if ((preset === 'CUSTOM' || (customSince && customUntil)) && customSince && customUntil) {
    return { since: customSince <= customUntil ? customSince : customUntil, until: customSince <= customUntil ? customUntil : customSince, preset: 'CUSTOM' };
  }
  if (preset === 'TODAY') return { since: today, until: today, preset };
  if (preset === 'YESTERDAY') {
    const y = addDays(today, -1);
    return { since: y, until: y, preset };
  }
  if (preset === 'THIS_WEEK_SUN_TODAY') return { since: startOfWeekSunday(today), until: today, preset };
  if (preset === 'LAST_7_DAYS') return { since: addDays(today, -7), until: addDays(today, -1), preset };
  if (preset === 'LAST_WEEK_SUN_SAT') {
    const thisSun = startOfWeekSunday(today);
    return { since: addDays(thisSun, -7), until: addDays(thisSun, -1), preset };
  }
  if (preset === 'LAST_14_DAYS') return { since: addDays(today, -14), until: addDays(today, -1), preset };
  if (preset === 'THIS_MONTH') return { since: startOfMonth(today), until: today, preset };
  if (preset === 'LAST_MONTH') return { ...lastMonthBounds(today), preset };
  if (preset === 'LAST_30_DAYS') return { since: addDays(today, -30), until: addDays(today, -1), preset };
  if (preset === 'LAST_30_TO_TODAY') return { since: addDays(today, -29), until: today, preset };
  if (preset === 'ALL_TIME') return { since: '2015-01-01', until: today, preset };
  return { since: addDays(today, -7), until: addDays(today, -1), preset: 'LAST_7_DAYS' };
}

export function dateWhere(input: DateRangeInput = {}): string {
  const preset = String(input.during || 'LAST_7_DAYS').toUpperCase().replace(/-/g, '_');
  const customSince = String(input.since || '').slice(0, 10);
  const customUntil = String(input.until || '').slice(0, 10);
  if (preset === 'CUSTOM' || (customSince && customUntil && preset === 'CUSTOM')) {
    const bounds = resolveDateBounds({ during: 'CUSTOM', since: customSince, until: customUntil });
    return `segments.date BETWEEN '${bounds.since}' AND '${bounds.until}'`;
  }
  if (preset === 'LAST_30_TO_TODAY' || preset === 'ALL_TIME') {
    const bounds = resolveDateBounds({ during: preset });
    return `segments.date BETWEEN '${bounds.since}' AND '${bounds.until}'`;
  }
  if (GAQL_PRESETS.has(preset)) return `segments.date DURING ${preset}`;
  return 'segments.date DURING LAST_7_DAYS';
}

export function datePresetLabel(input: DateRangeInput = {}): string {
  const preset = String(input.during || 'LAST_7_DAYS').toUpperCase().replace(/-/g, '_');
  const found = GOOGLE_ADS_DATE_PRESETS.find((item) => item.id === preset);
  const bounds = resolveDateBounds(input);
  const pretty = (ymd: string) => {
    const [y, m, d] = ymd.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
  };
  const span = bounds.since === bounds.until ? pretty(bounds.since) : `${pretty(bounds.since)} – ${pretty(bounds.until)}`;
  return `${found?.label || 'Last 7 days'} · ${span}`;
}
