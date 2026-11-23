/**
 * phone (last 10 digits) → registered MyFNG app / website customer.
 * Used for the "App user" badge in Bookings & Leads and the telecaller / manager CRM.
 */

export function last10Phone(v: unknown): string {
  return String(v || '').replace(/\D/g, '').slice(-10);
}

export type CustomerPhoneIndex = Map<string, { id: string; app_platform: string | null }>;
let customerPhoneIndexCache: { at: number; index: CustomerPhoneIndex } | null = null;

/** phone (last 10 digits) → app customer. Cached 2 min — the bookings page loads leads in many slices. */
export async function loadCustomerPhoneIndex(supabaseAdmin: any): Promise<CustomerPhoneIndex> {
  if (customerPhoneIndexCache && Date.now() - customerPhoneIndexCache.at < 120_000) {
    return customerPhoneIndexCache.index;
  }
  const index: CustomerPhoneIndex = new Map();
  const PAGE = 1000;
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id, phone, app_platform')
      .not('phone', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    for (const c of data as any[]) {
      const p10 = last10Phone(c.phone);
      if (p10.length === 10 && !index.has(p10)) {
        index.set(p10, { id: String(c.id), app_platform: c.app_platform ? String(c.app_platform) : null });
      }
    }
    if (data.length < PAGE) break;
  }
  customerPhoneIndexCache = { at: Date.now(), index };
  return index;
}

