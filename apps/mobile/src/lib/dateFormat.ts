function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toValidDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateDMY(date: string | number | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')}`;
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

