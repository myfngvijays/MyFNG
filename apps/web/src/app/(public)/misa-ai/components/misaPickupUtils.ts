/** IST calendar helpers for MISA pickup date/time pickers (aligned with book-service + chatbot rules). */

export type PickupTimeSlot = {
  hour: number;
  label: string;
  value: string;
};

export function getIndiaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    day: Number(get('day') || 1),
    month: Number(get('month') || 1),
    year: Number(get('year') || 1970),
    hour: Number(get('hour') || 0),
    minute: Number(get('minute') || 0),
  };
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getCurrentDateIST(): string {
  const { year, month, day } = getIndiaDateParts();
  return toIsoDate(year, month, day);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getNextDateIST(): string {
  return addDaysToIsoDate(getCurrentDateIST(), 1);
}

export function compareIsoDates(a: string, b: string): boolean {
  return a === b;
}

export function formatDateForButton(isoDate: string): string {
  const today = getCurrentDateIST();
  const tomorrow = getNextDateIST();
  const dayMonth = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(new Date(isoDate + 'T00:00:00+05:30'));

  if (compareIsoDates(isoDate, today)) return `Today, ${dayMonth}`;
  if (compareIsoDates(isoDate, tomorrow)) return `Tomorrow, ${dayMonth}`;

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(isoDate + 'T00:00:00+05:30'));
}

export function formatDateForChat(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00+05:30');
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';

  const monthYear = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return `${day}${suffix} ${monthYear}`;
}

/** Pickup slots 10 AM – 4 PM (chatbot format: "10 AM", "2 PM", …). */
export function buildPickupTimeSlots(): PickupTimeSlot[] {
  return Array.from({ length: 7 }, (_, i) => {
    const hour = 10 + i; // 10..16 => 10 AM through 4 PM
    const displayHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    const label = `${displayHour} ${period}`;
    return { hour, label, value: label };
  });
}

export function getCurrentHourIST(): number {
  return getIndiaDateParts().hour;
}

/** Same-day booking only before 4 PM IST when slots remain. */
export function isSameDayBookingAllowed(): boolean {
  return getCurrentHourIST() < 16;
}

export function isSlotPastForDate(isoDate: string, slotHour: number): boolean {
  if (isoDate !== getCurrentDateIST()) return false;
  return slotHour <= getCurrentHourIST();
}

export function getAvailableSlotsForDate(isoDate: string): PickupTimeSlot[] {
  return buildPickupTimeSlots().filter((slot) => !isSlotPastForDate(isoDate, slot.hour));
}

/** Default date: today if before 4 PM and slots remain; otherwise tomorrow. */
export function getDefaultPickupDate(): string {
  const today = getCurrentDateIST();
  if (!isSameDayBookingAllowed()) return getNextDateIST();
  if (getAvailableSlotsForDate(today).length === 0) return getNextDateIST();
  return today;
}
