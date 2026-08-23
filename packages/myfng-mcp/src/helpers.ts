import { maskPiiEnabled } from './db.js';

export function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function fail(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    isError: true as const,
  };
}

export function maskPhone(phone: unknown): string | null {
  if (phone == null) return null;
  const s = String(phone).replace(/\D/g, '');
  if (!s) return null;
  if (!maskPiiEnabled()) return String(phone);
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export function maskEmail(email: unknown): string | null {
  if (email == null) return null;
  const s = String(email);
  if (!maskPiiEnabled()) return s;
  const at = s.indexOf('@');
  if (at <= 1) return '***';
  return `${s[0]}***${s.slice(at)}`;
}

export function sanitizeLead(row: Record<string, unknown>) {
  return {
    ...row,
    customer_phone: maskPhone(row.customer_phone),
    customer_email: maskEmail(row.customer_email),
    phone: maskPhone(row.phone),
    email: maskEmail(row.email),
  };
}

export function sanitizeCall(row: Record<string, unknown>) {
  return {
    ...row,
    phone_number: maskPhone(row.phone_number),
    customer_phone: maskPhone(row.customer_phone),
  };
}

export function sanitizeUser(row: Record<string, unknown>) {
  return {
    ...row,
    phone: maskPhone(row.phone),
    email: maskEmail(row.email),
  };
}

/** IST day window → ISO UTC bounds (approx for queries). */
export function istDayRange(ymd?: string | null): { start: string; end: string; label: string } {
  const raw = (ymd || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).slice(0, 10);
  const start = new Date(`${raw}T00:00:00+05:30`);
  const end = new Date(`${raw}T23:59:59.999+05:30`);
  return { start: start.toISOString(), end: end.toISOString(), label: raw };
}

export function periodRange(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  date?: string | null,
): { start: string; end: string; label: string; period: string } {
  const base = istDayRange(date);
  const end = new Date(base.end);
  const start = new Date(base.start);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  else if (period === 'month') start.setUTCDate(start.getUTCDate() - 29);
  else if (period === 'year') start.setUTCFullYear(start.getUTCFullYear() - 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${period}:${base.label}`,
    period,
  };
}

export const BOOKED_STATUSES = [
  'BOOKING_CONFIRMED',
  'BOOKED',
  'CONFIRMED',
  'IN_SERVICE',
  'SERVICE_DONE',
  'COMPLETED',
  'VALIDATED',
] as const;

export const ALLOWED_TABLES = [
  'service_leads',
  'telecaller_call_logs',
  'telecaller_call_analyses',
  'smartflo_dial_sessions',
  'users_login',
  'roles',
  'workshops',
  'mechanic_jobs',
  'crm_lead_statuses',
  'crm_lead_tags',
] as const;

export type AllowedTable = (typeof ALLOWED_TABLES)[number];
