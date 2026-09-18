import { istDateString } from '@/lib/blog/dailyTopics';

export const MAX_DAILY_BLOGS = 5;
export const DEFAULT_DAILY_TIME = '10:00';

const DEFAULTS_BY_COUNT: Record<number, string[]> = {
  1: ['10:00'],
  2: ['10:00', '16:00'],
  3: ['10:00', '14:00', '18:00'],
  4: ['10:00', '13:00', '16:00', '19:00'],
  5: ['09:00', '12:00', '15:00', '18:00', '21:00'],
};

export type DailyBlogSlot = {
  index: number;
  time: string;
  minutes: number;
};

export type DailyBlogSchedule = {
  posts_per_day: number;
  times: string[];
  slots: DailyBlogSlot[];
  label: string;
};

export function normalizeHhmm(value: unknown): string | null {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function defaultTimesForCount(count: number): string[] {
  const n = Math.max(1, Math.min(MAX_DAILY_BLOGS, Number(count) || 1));
  return [...(DEFAULTS_BY_COUNT[n] || DEFAULTS_BY_COUNT[1])];
}

export function normalizePostTimes(raw: unknown, count?: number): string[] {
  const desired = Math.max(1, Math.min(MAX_DAILY_BLOGS, Number(count) || (Array.isArray(raw) ? raw.length : 1) || 1));
  const parsed = (Array.isArray(raw) ? raw : String(raw || '').split(','))
    .map((item) => normalizeHhmm(item))
    .filter((item): item is string => Boolean(item));
  const unique = [...new Set(parsed)];
  const defaults = defaultTimesForCount(desired);
  const times: string[] = [];
  for (let i = 0; i < desired; i += 1) {
    times.push(unique[i] || defaults[i] || DEFAULT_DAILY_TIME);
  }
  return times.sort((a, b) => minutesFromHhmm(a) - minutesFromHhmm(b));
}

export function minutesFromHhmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function istMinutesNow(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function resolveDailyBlogSchedule(settings?: {
  posts_per_day?: number | null;
  post_times?: unknown;
} | null): DailyBlogSchedule {
  const posts_per_day = Math.max(1, Math.min(MAX_DAILY_BLOGS, Number(settings?.posts_per_day) || 1));
  const times = normalizePostTimes(settings?.post_times, posts_per_day);
  const slots = times.map((time, idx) => ({
    index: idx + 1,
    time,
    minutes: minutesFromHhmm(time),
  }));
  return {
    posts_per_day,
    times,
    slots,
    label: times.map((time) => `${time} IST`).join(' · '),
  };
}

export function slotIsoForTime(time: string, now = new Date(), nextDay = false): string {
  const date = istDateString(now);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // IST = UTC+5:30
  const utc = Date.UTC(y, m - 1, d, hh - 5, mm - 30, 0) + (nextDay ? 86400000 : 0);
  return new Date(utc).toISOString();
}

export function nextDailySlotIso(schedule: DailyBlogSchedule, now = new Date(), postedIndexes: number[] = []): string {
  const nowMin = istMinutesNow(now);
  const posted = new Set(postedIndexes);
  const upcoming = schedule.slots.find((slot) => !posted.has(slot.index) && slot.minutes > nowMin);
  if (upcoming) return slotIsoForTime(upcoming.time, now, false);
  const first = schedule.slots[0];
  return slotIsoForTime(first?.time || DEFAULT_DAILY_TIME, now, true);
}

export function firstDueSlot(
  schedule: DailyBlogSchedule,
  postedIndexes: number[],
  now = new Date(),
  ignoreClock = false,
): DailyBlogSlot | null {
  const posted = new Set(postedIndexes);
  const nowMin = istMinutesNow(now);
  return (
    schedule.slots.find((slot) => !posted.has(slot.index) && (ignoreClock || nowMin >= slot.minutes)) || null
  );
}

export function dueSlotIndexes(schedule: DailyBlogSchedule, now = new Date()): number[] {
  const nowMin = istMinutesNow(now);
  return schedule.slots.filter((slot) => nowMin >= slot.minutes).map((slot) => slot.index);
}

export function overdueSlotIndexes(
  schedule: DailyBlogSchedule,
  postedIndexes: number[],
  now = new Date(),
  graceMinutes = 15,
): number[] {
  const posted = new Set(postedIndexes);
  const nowMin = istMinutesNow(now);
  return schedule.slots
    .filter((slot) => !posted.has(slot.index) && nowMin >= slot.minutes + graceMinutes)
    .map((slot) => slot.index);
}
