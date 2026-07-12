export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'all_time'
  | 'custom';

export const REPORT_DATE_PRESETS: Array<{ value: ReportDatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_14_days', label: 'Last 14 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

/** Common export dropdown presets (Today → Custom). */
export const EXPORT_DATE_PRESETS: Array<{ value: ReportDatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_14_days', label: 'Last 14 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth(),
    d: ist.getUTCDate(),
  };
}

function istYmdFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function istYmd(date = new Date()) {
  const { y, m, d } = istParts(date);
  return istYmdFromParts(y, m, d);
}

export function istDayBounds(ymd: string) {
  return {
    start: `${ymd}T00:00:00.000+05:30`,
    end: `${ymd}T23:59:59.999+05:30`,
  };
}

function addDaysYmd(ymd: string, delta: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + delta * 86400000;
  const shifted = new Date(utc - IST_OFFSET_MS);
  return istYmd(shifted);
}

export function resolveReportDateRange(
  preset: string,
  customStart?: string | null,
  customEnd?: string | null,
): { preset: ReportDatePreset; start: string; end: string; startYmd: string; endYmd: string; label: string } {
  const today = istYmd();
  const { y, m } = istParts();

  let startYmd = today;
  let endYmd = today;
  let label = 'Today';

  const normalized = String(preset || 'last_30_days').trim().toLowerCase() as ReportDatePreset;

  switch (normalized) {
    case 'today':
      startYmd = today;
      endYmd = today;
      label = 'Today';
      break;
    case 'yesterday':
      startYmd = addDaysYmd(today, -1);
      endYmd = startYmd;
      label = 'Yesterday';
      break;
    case 'last_7_days':
      startYmd = addDaysYmd(today, -6);
      endYmd = today;
      label = 'Last 7 days';
      break;
    case 'last_14_days':
      startYmd = addDaysYmd(today, -13);
      endYmd = today;
      label = 'Last 14 days';
      break;
    case 'last_30_days':
      startYmd = addDaysYmd(today, -29);
      endYmd = today;
      label = 'Last 30 days';
      break;
    case 'this_month':
      startYmd = istYmdFromParts(y, m, 1);
      endYmd = today;
      label = 'This month';
      break;
    case 'last_month': {
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear = m === 0 ? y - 1 : y;
      const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      startYmd = istYmdFromParts(prevYear, prevMonth, 1);
      endYmd = istYmdFromParts(prevYear, prevMonth, daysInPrevMonth);
      label = 'Last month';
      break;
    }
    case 'this_year':
      startYmd = istYmdFromParts(y, 0, 1);
      endYmd = today;
      label = 'This year';
      break;
    case 'all_time':
      startYmd = '1970-01-01';
      endYmd = today;
      label = 'All time';
      break;
    case 'custom':
      startYmd = String(customStart || today).slice(0, 10);
      endYmd = String(customEnd || today).slice(0, 10);
      if (startYmd > endYmd) {
        const tmp = startYmd;
        startYmd = endYmd;
        endYmd = tmp;
      }
      label = `${startYmd} to ${endYmd}`;
      break;
    default:
      startYmd = addDaysYmd(today, -29);
      endYmd = today;
      label = 'Last 30 days';
      break;
  }

  const startBounds = istDayBounds(startYmd);
  const endBounds = istDayBounds(endYmd);

  return {
    preset: normalized === 'custom' ? 'custom' : (normalized as ReportDatePreset),
    start: startBounds.start,
    end: endBounds.end,
    startYmd,
    endYmd,
    label,
  };
}

/** Apply created_at (or any timestamp column) filter when preset is not all_time. */
export function shouldApplyDateRangeFilter(preset?: string | null) {
  const normalized = String(preset || 'all_time').trim().toLowerCase();
  return normalized !== 'all_time' && normalized !== '';
}

export function applyReportDateRangeFilter<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  column: string,
  preset?: string | null,
  customStart?: string | null,
  customEnd?: string | null,
): T {
  if (!shouldApplyDateRangeFilter(preset)) return query;
  const range = resolveReportDateRange(String(preset), customStart, customEnd);
  return query.gte(column, range.start).lte(column, range.end);
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: Array<{ key: string; label: string }>) {
  const escape = (value: unknown) => {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return `\uFEFF${[header, ...lines].join('\n')}`;
}
