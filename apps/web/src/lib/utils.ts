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

