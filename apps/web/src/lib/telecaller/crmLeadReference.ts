export type CrmReferredBy = {
  lead_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  lead_number?: string;
};

export type CrmReferrerSearchHit = {
  id: string;
  lead_id?: string;
  customer_id?: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  status?: string;
  city?: string;
  source?: 'lead' | 'customer';
};

export function parseReferredBy(meta: unknown): CrmReferredBy | null {
  const raw =
    meta && typeof meta === 'object' ? (meta as { referred_by?: unknown }).referred_by : null;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const leadId = String(row.lead_id || '').trim();
  const customerId = String(row.customer_id || '').trim();
  const phone = String(row.customer_phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const name = String(row.customer_name || '').trim();
  if (!leadId && phone.length !== 10) return null;
  return {
    lead_id: leadId,
    customer_id: customerId || undefined,
    customer_name: name,
    customer_phone: phone,
    lead_number: String(row.lead_number || '').trim() || undefined,
  };
}

export function serializeReferredBy(row: CrmReferredBy | null): Record<string, unknown> | null {
  if (!row) return null;
  const phone = String(row.customer_phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const leadId = String(row.lead_id || '').trim();
  const customerId = String(row.customer_id || '').trim();
  if (!leadId && phone.length !== 10) return null;
  return {
    lead_id: leadId || null,
    customer_id: customerId || null,
    customer_name: String(row.customer_name || '').trim() || null,
    customer_phone: phone || null,
    lead_number: String(row.lead_number || '').trim() || null,
  };
}

export function referredByLabel(row: CrmReferredBy | null | undefined): string {
  if (!row) return '';
  return [row.customer_name, row.customer_phone].filter(Boolean).join(' · ');
}

export function referredByFromSearchHit(hit: CrmReferrerSearchHit): CrmReferredBy {
  const source = String(hit.source || '');
  const rawId = String(hit.lead_id || '').trim() || (source === 'customer' ? '' : String(hit.id || '').trim());
  const leadId = rawId.startsWith('customer:') ? '' : rawId;
  const customerId = String(hit.customer_id || '').trim();
  return {
    lead_id: leadId,
    customer_id: customerId || undefined,
    customer_name: String(hit.customer_name || '').trim(),
    customer_phone: String(hit.customer_phone || '')
      .replace(/\D/g, '')
      .slice(-10),
    lead_number: String(hit.lead_number || '').trim() || undefined,
  };
}
