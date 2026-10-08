const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** News `published_at` is an IST wall clock with no timezone. Read those digits as IST. */
export function storedIstParts(value?: string | null) {
  const match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { year, month, day, hour, minute, weekday };
}

export function formatNewsClock(value?: string | null) {
  const parts = storedIstParts(value);
  if (!parts) return '';
  const hour = parts.hour % 12 || 12;
  const suffix = parts.hour < 12 ? 'am' : 'pm';
  return `${hour}:${String(parts.minute).padStart(2, '0')} ${suffix}`;
}

export function formatNewsListingDate(value?: string | null) {
  const parts = storedIstParts(value);
  if (!parts) return '';
  return `${parts.day} ${MONTHS_SHORT[parts.month - 1]} ${parts.year}`;
}

export function formatNewsArticleWhen(value?: string | null) {
  const parts = storedIstParts(value);
  if (!parts) return '';
  return `${parts.weekday}, ${parts.day} ${MONTHS[parts.month - 1]} ${parts.year} at ${formatNewsClock(value)}`;
}

export function newsDatePublishedIso(value?: string | null) {
  const parts = storedIstParts(value);
  if (!parts) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:00+05:30`;
}
