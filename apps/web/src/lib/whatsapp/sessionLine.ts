/** Customer reply that opens the 6161 send window. 9696 replies do not. */

const SENDER_LINE_LAST10 = '9594996161';
const OTHER_LINE_LAST10 = '9167779696';

export function whatsAppBusinessLast10(row: {
  recipient_phone?: string | null;
  meta?: Record<string, unknown> | null;
} | null | undefined): string {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const nested =
    meta.metadata && typeof meta.metadata === 'object'
      ? (meta.metadata as Record<string, unknown>)
      : {};
  const raw = String(
    row?.recipient_phone ||
      meta.business_phone ||
      meta.display_phone_number ||
      nested.display_phone_number ||
      '',
  ).replace(/\D/g, '');
  return raw.slice(-10);
}

/** True only for a real inbound on the 6161 line. Missing line or 9696 stays closed. */
export function is6161SessionInbound(row: {
  direction?: string | null;
  recipient_phone?: string | null;
  meta?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (String(row?.direction || '').trim().toUpperCase() !== 'INBOUND') return false;
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  if (meta.seeded_from_lead || payload.source === 'service_lead') return false;
  const last10 = whatsAppBusinessLast10(row);
  if (!last10 || last10 === OTHER_LINE_LAST10) return false;
  return last10 === SENDER_LINE_LAST10;
}
