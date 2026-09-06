/** Mirror of apps/web/src/lib/preferred-slot.ts — keep parse/display in sync. */

export type PreferredSlotParts = {
  date: string | null;
  timeHm: string | null;
  iso: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowIst(now = new Date()): Date {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 5.5 * 60 * 60_000);
}

export function parsePreferredDate(raw: unknown, now = new Date()): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const lower = t.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  const ist = nowIst(now);
  if (/^today$/.test(lower) || /^aaj$/.test(lower)) return ymd(ist);
  if (/^tomorrow$/.test(lower) || /^kal$/.test(lower)) {
    const next = new Date(ist);
    next.setDate(next.getDate() + 1);
    return ymd(next);
  }

  const named = lower.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s*(\d{4})?$/);
  const namedFlip = lower.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?$/);
  const hit = named || namedFlip;
  if (hit) {
    const day = Number(named ? hit[1] : hit[2]);
    const month = MONTHS[String(named ? hit[2] : hit[1])];
    const year = hit[3] ? Number(hit[3]) : ist.getFullYear();
    if (Number.isFinite(month) && day >= 1 && day <= 31) {
      return `${year}-${pad2(month + 1)}-${pad2(day)}`;
    }
  }

  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}/.test(t)) {
    return t.slice(0, 10);
  }
  return null;
}

export function parsePreferredTime(raw: unknown): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;

  const hm24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm24) {
    const h = Number(hm24[1]);
    const m = Number(hm24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${pad2(h)}:${pad2(m)}`;
  }

  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] || 0);
    const mer = ampm[3].toLowerCase();
    if (h === 12) h = mer === 'am' ? 0 : 12;
    else if (mer === 'pm') h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${pad2(h)}:${pad2(m)}`;
  }

  const lower = t.toLowerCase();
  if (/\bmorning\b/.test(lower) || /\bsubah\b/.test(lower)) return '10:00';
  if (/\bafternoon\b/.test(lower) || /\bdopahar\b/.test(lower)) return '13:00';
  if (/\bevening\b/.test(lower) || /\bshaam\b/.test(lower)) return '16:00';
  return null;
}

export function buildPreferredSlot(
  dateRaw?: unknown,
  timeRaw?: unknown,
  now = new Date(),
): PreferredSlotParts {
  const date = parsePreferredDate(dateRaw, now);
  const timeHm = parsePreferredTime(timeRaw);
  const iso = date && timeHm ? `${date}T${timeHm}:00+05:30` : null;
  return { date, timeHm, iso };
}

export function formatPreferredSlotLabel(lead: {
  preferred_slot_start?: string | null;
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  preferred_service_slot?: string | null;
}): string | null {
  const slot = String(lead?.preferred_slot_start || '').trim();
  if (slot) {
    const d = new Date(slot);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  const built = buildPreferredSlot(
    lead?.preferred_date,
    lead?.preferred_time_slot || lead?.preferred_service_slot,
  );
  if (built.iso) {
    const d = new Date(built.iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  const date = String(lead?.preferred_date || '').trim();
  const time = String(lead?.preferred_time_slot || lead?.preferred_service_slot || '').trim();
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  if (time) return time;
  return null;
}
