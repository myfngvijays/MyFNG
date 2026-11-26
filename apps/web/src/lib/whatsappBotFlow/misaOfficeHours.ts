/** MISA auto-replies off during telecaller office hours (IST). */

const IST = 'Asia/Kolkata';

/** Office window when MISA stays quiet — assigned telecallers handle WhatsApp. */
export const MISA_QUIET_START = { hour: 9, minute: 30 } as const;
export const MISA_QUIET_END = { hour: 18, minute: 30 } as const;

function istMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** true = 9:30 AM–6:30 PM IST inclusive start, exclusive end at 6:30 → actually 9:30 to 18:30 means until 6:30 PM MISA quiet. */
export function isMisaQuietHours(now: Date = new Date()): boolean {
  const mins = istMinutesOfDay(now);
  const start = MISA_QUIET_START.hour * 60 + MISA_QUIET_START.minute;
  const end = MISA_QUIET_END.hour * 60 + MISA_QUIET_END.minute;
  return mins >= start && mins < end;
}