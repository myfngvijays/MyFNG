/**
 * CRM / Queue date presets (IST).
 * Today, Yesterday, Last 3/7/14 Days, This Month, Last Month, Custom Range.
 */

export type CrmDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_3_days'
  | 'last_7_days'
  | 'last_14_days'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom';

export const CRM_DATE_PRESETS: Array<{ value: CrmDatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_3_days', label: 'Last 3 Days' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_14_days', label: 'Last 14 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
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

export function shiftIstYmd(ymd: string, delta: number) {
  return addDaysYmd(ymd, delta);
}

export function resolveCrmDateRange(
  preset: string,
  customStart?: string | null,
  customEnd?: string | null,
): {
  preset: CrmDatePreset;
  start: string;
  end: string;
  startYmd: string;
  endYmd: string;
  label: string;
  allTime: boolean;
} {
  const today = istYmd();
  const { y, m } = istParts();

  let startYmd = today;
  let endYmd = today;
  let label = 'Today';
  let allTime = false;
  const normalized = String(preset || 'today').trim().toLowerCase() as CrmDatePreset;

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
    case 'last_3_days':
      startYmd = addDaysYmd(today, -2);
      endYmd = today;
      label = 'Last 3 Days';
      break;
    case 'last_7_days':
      startYmd = addDaysYmd(today, -6);
      endYmd = today;
      label = 'Last 7 Days';
      break;
    case 'last_14_days':
      startYmd = addDaysYmd(today, -13);
      endYmd = today;
      label = 'Last 14 Days';
      break;
    case 'this_month':
      startYmd = istYmdFromParts(y, m, 1);
      endYmd = today;
      label = 'This Month';
      break;
    case 'last_month': {
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear = m === 0 ? y - 1 : y;
      const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      startYmd = istYmdFromParts(prevYear, prevMonth, 1);
      endYmd = istYmdFromParts(prevYear, prevMonth, daysInPrevMonth);
      label = 'Last Month';
      break;
    }
    case 'all_time':
      allTime = true;
      startYmd = '2020-01-01';
      endYmd = today;
      label = 'All Time';
      break;
    case 'custom': {
      startYmd = String(customStart || today).slice(0, 10);
      endYmd = String(customEnd || today).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) startYmd = today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) endYmd = today;
      if (startYmd > endYmd) {
        const tmp = startYmd;
        startYmd = endYmd;
        endYmd = tmp;
      }
      label = `${startYmd} → ${endYmd}`;
      break;
    }
    default:
      startYmd = today;
      endYmd = today;
      label = 'Today';
      break;
  }

  const startBounds = istDayBounds(startYmd);
  const endBounds = istDayBounds(endYmd);
  return {
    preset: (['custom', 'all_time'].includes(normalized)
      ? normalized
      : CRM_DATE_PRESETS.some((p) => p.value === normalized)
        ? normalized
        : 'today') as CrmDatePreset,
    start: startBounds.start,
    end: endBounds.end,
    startYmd,
    endYmd,
    label,
    allTime,
  };
}
