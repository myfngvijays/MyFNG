import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
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

/**
 * Format date/time for a specific timezone (defaults to IST - Asia/Kolkata)
 * Output example: 07-01-2026 09:25 AM
 */
export function formatDateTimeIST(
  date: string | number | Date | null | undefined,
  timeZone: string = 'Asia/Kolkata'
): string {
  const d = toValidDate(date);
  if (!d) return '';

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Build "DD-MM-YYYY HH:MM AM/PM" from parts to avoid locale punctuation
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod') || '';

  return `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod.toUpperCase()}`;
}

function normalizeTimestampAssumeUTC(
  value: string | number | Date | null | undefined
): string | number | Date | null | undefined {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return raw;

  // Accept timezone suffixes like Z, +00, +0000, +00:00
  const hasTimezone = /([zZ]|[+\-]\d{2}(:?\d{2})?)$/.test(raw);
  if (hasTimezone) return raw;

  const looksLikeDateTime =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(raw);
  if (!looksLikeDateTime) return raw;

  return `${raw.replace(' ', 'T')}Z`;
}

export function formatDateTimeISTAssumeUTC(
  date: string | number | Date | null | undefined,
  timeZone: string = 'Asia/Kolkata'
): string {
  return formatDateTimeIST(normalizeTimestampAssumeUTC(date), timeZone);
}

// Backward-compatible alias used across the app
export function formatDate(date: string | number | Date | null | undefined): string {
  return formatDateTime(date);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

