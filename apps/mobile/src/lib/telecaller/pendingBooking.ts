import { apiFetch } from '../api';
import { resolveAdminCrmStatusId } from './adminCrmStatus';

/**
 * Customer booked from App / Website / MISA, lead is Fresh and nobody has called since.
 * Same rule as web `isPendingBookingLead` (apps/web/src/lib/telecaller/leadSourceTag.ts).
 */

function ms(value: unknown): number {
  if (!value) return 0;
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function metaOf(lead: any): Record<string, any> {
  return lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
}

function isFresh(lead: any) {
  const result = String(metaOf(lead).last_call_result || '').trim().toUpperCase();
  if (result === 'FRESH') return true;
  return resolveAdminCrmStatusId(lead) === 'FRESH';
}

export function isPendingBookingLead(lead: any): boolean {
  if (!lead) return false;
  const meta = metaOf(lead);
  const bookedAt = ms(meta.priority_booking_at);
  if (!bookedAt) {
    // List rows: the server already worked it out (lead_from.tone === 'booking').
    return lead?.lead_from?.tone === 'booking' && isFresh(lead);
  }
  if (!isFresh(lead)) return false;
  const calledAt = Math.max(ms(lead?.last_call_at), ms(meta.last_call_at), ms(meta.priority_booking_acked_at));
  return !(calledAt > bookedAt);
}

/**
 * Pill text for the leads list, e.g. "🔔 App Booking · call pending".
 * Only the server label (already checked against the "Lead source dekhna" permission) names the channel.
 */
export function pendingBookingPill(lead: any): string {
  const fromServer = String(lead?.lead_from?.tone === 'booking' ? lead?.lead_from?.label || '' : '').trim();
  return fromServer ? `🔔 ${fromServer}` : '🔔 Booking · call pending';
}

/** "Mark as called" — server stamps coupon_meta.priority_booking_acked_at. */
export async function ackPendingBooking(leadId: string) {
  return apiFetch<{ ok?: boolean; priority_booking_acked_at?: string; error?: string }>(
    `/api/telecaller/crm/leads/${encodeURIComponent(leadId)}/ack-booking`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
}
