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
 * UTC cron for those IST slots.
 * Also ticks at 09:30 and 15:00 IST; the runner skips those.
 */
export const AUTOMOBILE_NEWS_CRON_UTC = '0,30 4-9 * * *';

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

/** Slot whose 20-minute window contains now, or null between slots and outside 10:00–14:50. */
export function currentAutomobileNewsSlot(now = new Date()): string | null {
  const mins = istMinutes(now);
  for (const slot of AUTOMOBILE_NEWS_SLOTS_IST) {
    const start = slotStart(slot);
    if (mins >= start && mins < start + 20) return slot;
  }
  return null;
}

/** Slots whose window has already closed, so a story should already be live. */
export function automobileNewsSlotsDue(now = new Date()): number {
  const mins = istMinutes(now);
  return AUTOMOBILE_NEWS_SLOTS_IST.filter((slot) => mins >= slotStart(slot) + 20).length;
}
