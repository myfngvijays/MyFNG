function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toValidDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hermes on some simulators rejects Asia/Kolkata. Fall back to a fixed IST offset. */
function istCalendarParts(d: Date): { day: string; month: string; year: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (day && month && year) return { day, month, year };
  } catch {
    /* timezone data missing */
  }
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    day: pad2(ist.getUTCDate()),
    month: pad2(ist.getUTCMonth() + 1),
    year: String(ist.getUTCFullYear()),
  };
}

export function formatDateDMY(date: string | number | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return '';
  const { day, month, year } = istCalendarParts(d);
  return `${day}-${month}-${year}`;
}

export function formatTime12h(date: string | number | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return '';
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${pad2(hours12)}:${pad2(minutes)} ${ampm}`;
}

export function formatDateTime(date: string | number | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return '';
  return `${formatDateDMY(d)} ${formatTime12h(d)}`;
}

