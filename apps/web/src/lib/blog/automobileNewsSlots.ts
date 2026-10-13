/** 10 IST slots, every 30 minutes from 10:00 through 14:30. */
export const AUTOMOBILE_NEWS_SLOTS_IST = [
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
] as const;

export const AUTOMOBILE_NEWS_SCHEDULE_LABEL = '10:00–14:30 IST · every 30 min · 10 stories';

/**
 * UTC cron. Every 10 minutes from 09:30 through 15:20 IST.
 * The runner skips ticks before 10:00 IST and fills the oldest empty slot.
 */
export const AUTOMOBILE_NEWS_CRON_UTC = '*/10 4-9 * * *';

function istMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
  return get('hour') * 60 + get('minute');
}

function slotStart(slot: string) {
  const [hour, minute] = slot.split(':').map((part) => Number(part));
  return hour * 60 + minute;
}

/** Catch-up stops at 15:30 IST, after the 14:30 slot has had time to retry. */
const CATCHUP_END_MINUTES = 15 * 60 + 30;

/** Oldest slot that has started and still has no story. Null before 10:00 and after 15:30 IST. */
export function earliestUnfilledAutomobileNewsSlot(filled: Iterable<string>, now = new Date()): string | null {
  const mins = istMinutes(now);
  if (mins < slotStart(AUTOMOBILE_NEWS_SLOTS_IST[0]) || mins >= CATCHUP_END_MINUTES) return null;
  const taken = new Set(filled);
  for (const slot of AUTOMOBILE_NEWS_SLOTS_IST) {
    if (mins >= slotStart(slot) && !taken.has(slot)) return slot;
  }
  return null;
}

/** Slots that should already have a story. Five minutes of grace after the start. */
export function automobileNewsSlotsDue(now = new Date()): number {
  const mins = istMinutes(now);
  return AUTOMOBILE_NEWS_SLOTS_IST.filter((slot) => mins >= slotStart(slot) + 5).length;
}
