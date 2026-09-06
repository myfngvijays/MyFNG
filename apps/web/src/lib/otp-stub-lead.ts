/** Placeholder names from OTP stubs: Customer_1776 */
export function isPlaceholderCustomerName(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n || n.length < 2) return true;
  if (/^customer[_\s-]?\d*$/i.test(n)) return true;
  if (/^whatsapp\s*customer$/i.test(n)) return true;
  return false;
}

function leadAmount(row: any): number {
  const n = Number(row?.estimated_amount ?? row?.actual_amount ?? row?.amount_display ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Empty OTP / abandoned-booking stub (Customer_XXXX, ₹0), not a named checkout.
 * Client-safe — do not import service-lead-reopen from 'use client' pages.
 */
export function isDisposableOtpStubLead(row: any): boolean {
  if (!row) return false;
  const status = String(row.status || '').toUpperCase();
  if (
    status === 'VALIDATED' ||
    status === 'ASSIGNED' ||
    status === 'ACCEPTED' ||
    status === 'IN_PROGRESS' ||
    status === 'ASSIGNED_TO_WORKSHOP' ||
    status === 'COMPLETED'
  ) {
    return false;
  }
  if (!isPlaceholderCustomerName(row.customer_name)) return false;
  if (leadAmount(row) > 0) return false;
  return row.is_incomplete === true || status === 'NEW' || status === 'REJECTED';
}

export function hideOtpStubsWhenNamedBookingExists<T extends {
  customer_phone?: string | null;
  customer_name?: string | null;
  is_incomplete?: boolean | null;
  estimated_amount?: unknown;
  actual_amount?: unknown;
  amount_display?: unknown;
}>(leads: T[]): T[] {
  const digitKey = (phone: string | null | undefined) => {
    const d = String(phone || '').replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  };
  const phonesWithNamed = new Set<string>();
  for (const lead of leads) {
    const key = digitKey(lead.customer_phone);
    if (!key) continue;
    if (isPlaceholderCustomerName(lead.customer_name)) continue;
    phonesWithNamed.add(key);
  }
  if (!phonesWithNamed.size) return leads;
  return leads.filter((lead) => {
    const key = digitKey(lead.customer_phone);
    if (!key || !phonesWithNamed.has(key)) return true;
    return !isDisposableOtpStubLead(lead);
  });
}
