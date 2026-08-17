/** Report period presets (IST) for Advanced CRM Reports. */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

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

function addDaysYmd(ymd: string, delta: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + delta * 86400000;
  return istYmd(new Date(utc - IST_OFFSET_MS));
}

export function resolveReportPeriod(
  period: string,
  anchorYmd?: string | null,
): { period: ReportPeriod; start: string; end: string; startYmd: string; endYmd: string; label: string } {
  const today = istYmd();
  const anchor = String(anchorYmd || today).slice(0, 10);
  const p = (String(period || 'day').toLowerCase() as ReportPeriod) || 'day';
  const { y, m } = (() => {
    const [yy, mm, dd] = anchor.split('-').map(Number);
    return { y: yy, m: mm - 1, d: dd };
  })();

  let startYmd = anchor;
  let endYmd = anchor;
  let label = 'Today';

  if (p === 'day') {
    startYmd = anchor;
    endYmd = anchor;
    label = anchor === today ? 'Today' : anchor;
  } else if (p === 'week') {
    // Last 7 days ending on anchor
    startYmd = addDaysYmd(anchor, -6);
    endYmd = anchor;
    label = 'Last 7 days';
  } else if (p === 'month') {
    startYmd = istYmdFromParts(y, m, 1);
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    endYmd = istYmdFromParts(y, m, lastDay);
    if (endYmd > today) endYmd = today;
    label = 'This month';
  } else {
    startYmd = istYmdFromParts(y, 0, 1);
    endYmd = today;
    label = String(y);
  }

  return {
    period: p,
    start: `${startYmd}T00:00:00.000+05:30`,
    end: `${endYmd}T23:59:59.999+05:30`,
    startYmd,
    endYmd,
    label,
  };
}

export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

export function initialsFromName(name: string | null | undefined): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function normalizePhoneKey(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}
