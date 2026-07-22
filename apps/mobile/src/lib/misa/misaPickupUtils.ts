export type PickupTimeSlot = { hour: number; label: string; value: string };

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

export function getDefaultPickupDate(): string {
  const today = getCurrentDateIST();
  if (!isSameDayBookingAllowed()) return getNextDateIST();
  if (getAvailableSlotsForDate(today).length === 0) return getNextDateIST();
  return today;
}

export function normalizeIsoDate(value?: string | null): string {
  const fallback = getDefaultPickupDate();
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback;
}

export function formatDateForChat(isoDate: string): string {
  const normalized = normalizeIsoDate(isoDate);
  const date = new Date(normalized + 'T00:00:00+05:30');
  if (Number.isNaN(date.getTime())) return normalized;
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const monthYear = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return `${day}${suffix} ${monthYear}`;
}

export function buildPickupTimeSlots(): PickupTimeSlot[] {
  return Array.from({ length: 7 }, (_, i) => {
    const hour = 10 + i;
    const displayHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    const label = `${displayHour} ${period}`;
    return { hour, label, value: label };
  });
}

export function getCurrentHourIST(): number {
  return getIndiaDateParts().hour;
}

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

export function formatDateForButton(isoDate: string): string {
  const normalized = normalizeIsoDate(isoDate);
  const date = new Date(normalized + 'T00:00:00+05:30');
  if (Number.isNaN(date.getTime())) return normalized;
  const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(date);
  if (normalized === getCurrentDateIST()) return `Today, ${dayName}`;
  if (normalized === getNextDateIST()) return `Tomorrow, ${dayName}`;
  return dayName;
}

export function buildQuickDates(minDate: string, count = 7): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(addDaysToIsoDate(minDate, i));
  }
  return out;
}

export function isoFromDatePickerValue(value: Date): string {
  return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
}
