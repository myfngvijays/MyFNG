export type CrmReferredBy = {
  lead_id: string;
  customer_name: string;
  customer_phone: string;
  lead_number?: string;
};

export function parseReferredBy(meta: unknown): CrmReferredBy | null {
  const raw =
    meta && typeof meta === 'object' ? (meta as { referred_by?: unknown }).referred_by : null;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const leadId = String(row.lead_id || '').trim();
  const phone = String(row.customer_phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const name = String(row.customer_name || '').trim();
  if (!leadId && phone.length !== 10) return null;
  return {
    lead_id: leadId,
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
  if (!leadId && phone.length !== 10) return null;
  return {
    lead_id: leadId || null,
    customer_name: String(row.customer_name || '').trim() || null,
    customer_phone: phone || null,
    lead_number: String(row.lead_number || '').trim() || null,
  };
}

export function referredByLabel(row: CrmReferredBy | null | undefined): string {
  if (!row) return '';
  return [row.customer_name, row.customer_phone].filter(Boolean).join(' · ');
}
