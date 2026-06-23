import { normalizePhone } from '@/lib/coupon-rules';

type CustomerIdentity = { id: string; phone: string };

export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  return normalizePhone(phone);
}

export async function findCustomerByPhone(supabaseAdmin: any, phone: string | null | undefined) {
  const normalized = normalizeCustomerPhone(phone);
  if (!normalized) return null;

  const { data: exact } = await supabaseAdmin
    .from('customers')
    .select('id, phone, email, full_name, firebase_uid, profile_image, phone_verified, email_verified, is_active')
    .eq('phone', normalized)
    .maybeSingle();
  if (exact?.id) return exact;

  const { data: fuzzy } = await supabaseAdmin
    .from('customers')
    .select('id, phone, email, full_name, firebase_uid, profile_image, phone_verified, email_verified, is_active')
    .or(`phone.eq.91${normalized},phone.eq.+91${normalized},phone.ilike.%${normalized}`)
    .limit(1)
    .maybeSingle();

  return fuzzy || null;
}

export function phoneDigitsMatch(
  storedPhone: string | null | undefined,
  customerPhone: string | null | undefined,
): boolean {
  const stored = normalizePhone(storedPhone);
  const expected = normalizePhone(customerPhone);
  if (!stored || !expected) return false;
  return stored === expected;
}

export function leadBelongsToCustomer(
  lead: { customer_phone?: string | null; meta?: unknown },
  customer: CustomerIdentity,
): boolean {
  const meta =
    lead.meta && typeof lead.meta === 'object' && !Array.isArray(lead.meta)
      ? (lead.meta as Record<string, unknown>)
      : null;
  if (meta?.customer_id && String(meta.customer_id) === customer.id) return true;
  return phoneDigitsMatch(lead.customer_phone, customer.phone);
}

/** Match service_leads rows for a logged-in customer (phone variants + meta.customer_id). */
export function buildCustomerLeadOrFilter(customer: CustomerIdentity): string {
  const phone = normalizePhone(customer.phone);
  const parts = [`meta->>customer_id.eq.${customer.id}`];
  if (phone) {
    parts.push(
      `customer_phone.eq.${phone}`,
      `customer_phone.eq.91${phone}`,
      `customer_phone.eq.+91${phone}`,
      `customer_phone.ilike.%${phone}`,
    );
  }
  return parts.join(',');
}

export function filterLeadsForCustomer<T extends { customer_phone?: string | null; meta?: unknown }>(
  rows: T[] | null | undefined,
  customer: CustomerIdentity,
): T[] {
  return (rows || []).filter((row) => leadBelongsToCustomer(row, customer));
}

export function toServiceLeadType(input: string | null | undefined): string {
  const raw = String(input || '').trim().toUpperCase();
  if (raw === 'CAR_SERVICE') return 'NORMAL';
  if (raw === 'HOME_CAR_SERVICE') return 'HOME_SERVICE';
  if (raw === 'RSA') return 'RSA';
  if (raw === 'NORMAL' || raw === 'HOME_SERVICE') return raw;
  return 'NORMAL';
}
